
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
  count: z.number().min(1).max(10).default(5).describe('The number of words to suggest.'),
  maxWordLength: z.number().min(3).optional().describe('Optional maximum length for the suggested words.'),
});
export type SuggestWordsInput = z.infer<typeof SuggestWordsInputSchema>;

const SuggestWordsOutputSchema = z.array(z.string()).min(1).describe("An array of distinct, simple, drawable common nouns representing physical objects.");
export type SuggestWordsOutput = z.infer<typeof SuggestWordsOutputSchema>;


export async function suggestWords(input: SuggestWordsInput): Promise<SuggestWordsOutput> {
  return suggestWordsFlow(input);
}

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const defaultFallbackWordsLarge = [
    "Apple", "House", "Star", "Car", "Tree", "Book", "Sun", "Moon", "Chair", "Guitar", 
    "Lamp", "Phone", "Key", "Door", "Clock", "Shoes", "Hat", "Banana", "Orange", "Grape",
    "Bread", "Cheese", "Pizza", "Cloud", "Pencil", "Brush", "Plane", "Train", "Boat", 
    "Ball", "Box", "Cup", "Fish", "Duck", "Kite", "Drum", "Cake", "Sock", "Fork", 
    "Spoon", "Plate", "Plant", "Flower", "Dog", "Cat", "Bird", "Mouse", "Bear", "Lion",
    "Tiger", "Snake", "Spider", "Ant", "Bee", "Ladybug", "Butterfly", "Snail", "Frog",
    "Shirt", "Pants", "Dress", "Socks", "Scarf", "Gloves", "Ring", "Necklace", "Watch",
    "Table", "Bed", "Sofa", "Mirror", "Window", "Stairs", "Bridge", "Road", "River",
    "Mountain", "Volcano", "Island", "Beach", "Forest", "Desert", "Rainbow", "Anchor",
    "Balloon", "Candle", "Camera", "Computer", "Dice", "Earrings", "Feather", "Flag", 
    "Fountain", "Hammer", "Helmet", "Igloo", "Jacket", "Ladder", "Magnet", "Medal",
    "Microphone", "Notebook", "Octopus", "Pear", "Pineapple", "Pyramid", "Quilt", 
    "Robot", "Rocket", "Sailboat", "Scissors", "Shovel", "Skateboard", "Suitcase",
    "Swing", "Sword", "Telescope", "Tent", "Trophy", "Trumpet", "Umbrella", "Unicorn",
    "Vase", "Violin", "Wallet", "Wheel", "Whistle", "Yacht", "Zebra", "Zipper"
];

const generateFallbackWords = (count: number, maxWordLength?: number, previouslyUsedWords?: string[]): string[] => {
    let finalWords: string[] = [];
    const shuffledFallbacks = shuffleArray(defaultFallbackWordsLarge);
    const localUsedWords = new Set((previouslyUsedWords || []).map(w => w.toLowerCase()));
    
    for (const fb of shuffledFallbacks) {
        if (finalWords.length >= count) break;
        const fbLower = fb.toLowerCase();
        if (!localUsedWords.has(fbLower) && 
            !finalWords.map(w => w.toLowerCase()).includes(fbLower) &&
            (maxWordLength ? fb.length <= maxWordLength : true)
        ) {
            finalWords.push(fb);
        }
    }
    
    // If still not enough words, use a very basic padding mechanism
    const absolutePads = ["Pencil", "Paper", "Note", "Clip", "Pin", "Item", "Thing", "Object", "Icon", "Symbol"];
    let padIdx = 0;
    while(finalWords.length < count){
        const baseWord = absolutePads[padIdx % absolutePads.length];
        let potentialWord = baseWord;
        let attempt = 0;
        while(finalWords.map(w=>w.toLowerCase()).includes(potentialWord.toLowerCase()) || localUsedWords.has(potentialWord.toLowerCase())) {
            attempt++; 
            potentialWord = baseWord + attempt; 
            if (attempt > 10) { 
                potentialWord = baseWord + Math.floor(Math.random()*1000); 
                if(finalWords.map(w=>w.toLowerCase()).includes(potentialWord.toLowerCase()) || localUsedWords.has(potentialWord.toLowerCase())){
                   potentialWord = baseWord + "X" + Math.floor(Math.random()*1000); // Even more unique
                }
                break;
            }
        }
         if (maxWordLength ? potentialWord.length <= maxWordLength : true) {
             finalWords.push(potentialWord);
         } else {
            // If padded word is too long, try a shorter base or just a random short string
            const shortBase = baseWord.substring(0, Math.min(baseWord.length, (maxWordLength || 20) - 2));
            finalWords.push(shortBase + Math.floor(Math.random()*10)); 
         }
        padIdx++;
    }
    return finalWords.slice(0, count);
};


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
      if (output && Array.isArray(output)) {
        let filteredOutput = output.filter(word => typeof word === 'string' && word.trim().length > 0 && /^[a-zA-Z]+$/.test(word.trim())); 
        if (input.maxWordLength) {
            filteredOutput = filteredOutput.filter(word => word.length <= input.maxWordLength!);
        }
        const distinctWords = Array.from(new Set(filteredOutput.map(w => w.toLowerCase()))).map(lw => filteredOutput.find(w => w.toLowerCase() === lw)!);

        if (distinctWords.length >= input.count) {
            return distinctWords.slice(0, input.count) as SuggestWordsOutput;
        } else {
            console.warn(`Gemini returned ${distinctWords.length} distinct valid words (expected ${input.count}). Output:`, output, "Filtered:", filteredOutput, "Distinct:", distinctWords, "Using enhanced fallback.");
            const fallbackWords = generateFallbackWords(input.count - distinctWords.length, input.maxWordLength, [...input.previouslyUsedWords, ...distinctWords]);
            return [...distinctWords, ...fallbackWords].slice(0, input.count) as SuggestWordsOutput;
        }
      }
      console.error('Gemini did not return the expected array format. Received:', output, "Using enhanced fallback.");
      return generateFallbackWords(input.count, input.maxWordLength, input.previouslyUsedWords) as SuggestWordsOutput;
    } catch (error) {
      console.error("Error in suggestWordsFlow:", error, "Using enhanced fallback.");
      return generateFallbackWords(input.count, input.maxWordLength, input.previouslyUsedWords) as SuggestWordsOutput;
    }
  }
);

