
// This is an AI-powered system for recommending personalized German lessons.
'use server';

/**
 * @fileOverview An AI agent that recommends personalized German lessons and exercises based on user progress and weaker areas.
 *
 * - recommendAiLesson - A function that handles the lesson recommendation process.
 * - RecommendAiLessonInput - The input type for the recommendAiLesson function.
 * - RecommendAiLessonOutput - The return type for the recommendAiLesson function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GrammarWeaknessContextSchema = z.object({
    level: z.string().describe("The CEFR level of the topic context."),
    topicName: z.string().describe("The name of the topic where this grammar weakness was observed."),
    moduleId: z.string().optional().describe("The module type (e.g., 'grammar', 'writing') where the error occurred.")
});

const GrammarWeaknessDetailSchema = z.object({
    count: z.number().describe("How many times this specific grammar error tag has been recorded for the user."),
    lastEncounteredDate: z.string().describe("ISO date string of when this error was last recorded."),
    exampleContexts: z.array(GrammarWeaknessContextSchema).describe("Examples of contexts (level, topic name, module) where this weakness was observed. Limited to a few recent examples.")
});


const RecommendAiLessonInputSchema = z.object({
  userLevel: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('The current German language level of the user.'),
  userProgress: z.record(z.string(), z.number()).describe('A record of the user\'s progress in each topic, with topic names as keys and progress percentages as values. Example format: "A1 - Хобби и увлечения: 75%"'),
  weakAreas: z.array(z.string()).describe('An array of the user\'s weaker areas in German learning, typically identifying modules with low scores or not yet started. Example format: "Низкий результат (40%) по модулю \'Грамматика\' в теме \'Работа и профессии\' (уровень A1)." или "Модуль \'Аудирование\' в теме \'Путешествия и транспорт\' (уровень A1) не начат."'),
  preferredTopics: z.array(z.string()).optional().describe('An optional array of topics the user prefers to learn about.'),
  grammarWeaknesses: z.record(z.string(), GrammarWeaknessDetailSchema).optional().describe('A record of specific, recurring grammar errors the user makes. The key is an English snake_case tag for the grammar concept (e.g., "akkusativ_prepositions"). The value provides details like count, last date, and example contexts.'),
});
export type RecommendAiLessonInput = z.infer<typeof RecommendAiLessonInputSchema>;

const RecommendAiLessonOutputSchema = z.object({
  topic: z.string().describe('The recommended topic for the next lesson.'),
  modules: z.array(z.string()).describe('An array of recommended learning modules for the topic, such as vocabulary, grammar, listening, reading, and writing.'),
  reasoning: z.string().describe('The AI\'s reasoning for recommending this topic and these modules.'),
});
export type RecommendAiLessonOutput = z.infer<typeof RecommendAiLessonOutputSchema>;

export async function recommendAiLesson(input: RecommendAiLessonInput): Promise<RecommendAiLessonOutput> {
  return recommendAiLessonFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendAiLessonPrompt',
  input: {schema: RecommendAiLessonInputSchema},
  output: {schema: RecommendAiLessonOutputSchema},
  prompt: `You are an AI-powered German language learning assistant. Your task is to recommend a personalized lesson for the user based on their current level, progress, weaker areas, specific grammar weaknesses, and preferences.

  User Level: {{{userLevel}}}
  User Progress (general overview of topic completion):
  {{#if userProgress}}
    {{#each userProgress}}
      - {{{@key}}}: {{{this}}}%
    {{/each}}
  {{else}}
    No progress data available.
  {{/if}}

  General Weaker Areas (modules with low scores or not started):
  {{#if weakAreas}}
    {{#each weakAreas}}
      - {{{this}}}
    {{/each}}
  {{else}}
    No specific general weak areas identified by module scores.
  {{/if}}

  Specific Grammar Weaknesses (recurring errors with specific grammar concepts):
  {{#if grammarWeaknesses}}
    {{#each grammarWeaknesses}}
      - Grammar Concept: '{{@key}}'
        - Count: {{this.count}}
        - Last Encountered: {{this.lastEncounteredDate}}
        - Example Contexts:
        {{#each this.exampleContexts}}
          - In topic '{{this.topicName}}' (Level: {{this.level}}{{#if this.moduleId}}, Module: {{this.moduleId}}{{/if}})
        {{/each}}
    {{/each}}
  {{else}}
    No specific recurring grammar weaknesses tracked.
  {{/if}}

  Preferred Topics: {{#if preferredTopics}}{{#each preferredTopics}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None specified{{/if}}

  Based on ALL this information, recommend a topic and a set of learning modules (vocabulary, grammar, listening, reading, writing) that would be most beneficial for the user.

  **Prioritization Strategy:**
  1.  **Specific Grammar Weaknesses:** If 'grammarWeaknesses' data is present, STRONGLY prioritize recommending a topic and the 'grammar' module to address the most pressing or frequently occurring grammar error. Choose a topic that is either one of 'exampleContexts' for that weakness (if it's not yet completed) or a new topic known to cover that grammar concept well for the user's level ({{{userLevel}}}). Clearly state in 'reasoning' which grammar weakness you are addressing.
  2.  **General Weaker Areas in Grammar:** If 'weakAreas' contains entries like "Низкий результат по модулю 'Грамматика' в теме X" or "Модуль 'Грамматика' в теме X не начат", and no specific grammar weaknesses override this, consider recommending topic X with a focus on 'grammar', or a new topic suitable for grammar practice at level {{{userLevel}}}. Consider also suggesting a grammar-focused exercise for a topic that the user did well on if that topic is particularly well-suited to review the identified weak grammar concept.
  3.  **Other General Weaker Areas:** Address other module weaknesses (vocabulary, listening, etc.) by suggesting relevant topics and modules.
  4.  **Preferred Topics:** If preferred topics align with an opportunity to address a weakness (especially grammar), prioritize that. Otherwise, if no pressing weaknesses, select a preferred topic if suitable for the user's level and progress.
  5.  **Progression:** If no specific weaknesses or strong preferences guide the choice, select the next logical uncompleted topic for the user's current level.

  Explain your reasoning for the recommendation.
  Respond in Russian.

  Example output:
  {
    "topic": "Die Familie",
    "modules": ["vocabulary", "grammar", "listening"],
    "reasoning": "Вы часто допускаете ошибки с дательным падежом (Dativ), что было отмечено в теме 'Старая Тема'. Тема 'Die Familie' хорошо подходит для практики Dativ на вашем уровне (A1). Также, мы рекомендуем модули лексики и аудирования для общего развития."
  }
  `,
});

const MAX_RETRIES = 5; 
const INITIAL_RETRY_DELAY_MS = 3000; 

const recommendAiLessonFlow = ai.defineFlow(
  {
    name: 'recommendAiLessonFlow',
    inputSchema: RecommendAiLessonInputSchema,
    outputSchema: RecommendAiLessonOutputSchema,
  },
  async input => {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const {output} = await prompt(input);
        if (!output) {
          throw new Error('[recommendAiLessonFlow] AI model returned an empty output.');
        }
        return output;
      } catch (error: any) {
        retries++;
        if (retries >= MAX_RETRIES) {
          // Log the input for debugging failed recommendations
          console.error(`[recommendAiLessonFlow] Failed after ${MAX_RETRIES} attempts. Last error:`, error, "Input was:", JSON.stringify(input, null, 2));
          throw error; 
        }
        
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        if (
          errorMessage.includes('503') ||
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('model is overloaded') ||
          errorMessage.includes('server error') || 
          errorMessage.includes('internal error') 
        ) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1); 
          console.warn(`[recommendAiLessonFlow] Attempt ${retries} failed with transient error. Retrying in ${delay / 1000}s... Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('[recommendAiLessonFlow] Failed with non-retryable error:', error, "Input was:", JSON.stringify(input, null, 2));
          throw error;
        }
      }
    }
    throw new Error('[recommendAiLessonFlow] Failed after multiple retries, and loop exited unexpectedly.');
  }
);
