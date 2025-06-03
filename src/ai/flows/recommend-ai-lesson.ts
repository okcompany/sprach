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

const RecommendAiLessonInputSchema = z.object({
  userLevel: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('The current German language level of the user.'),
  userProgress: z.record(z.string(), z.number()).describe('A record of the user\'s progress in each topic, with topic names as keys and progress percentages as values.'),
  weakAreas: z.array(z.string()).describe('An array of the user\'s weaker areas in German learning, such as vocabulary, grammar, listening, reading, or writing.'),
  preferredTopics: z.array(z.string()).optional().describe('An optional array of topics the user prefers to learn about.'),
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
  prompt: `You are an AI-powered German language learning assistant. Your task is to recommend a personalized lesson for the user based on their current level, progress, weaker areas, and preferences.

  User Level: {{{userLevel}}}
  User Progress: {{#each userProgress}}{{{@key}}}: {{{this}}}% {{/each}}
  Weaker Areas: {{#each weakAreas}}{{{this}}} {{/each}}
  Preferred Topics: {{#if preferredTopics}}{{#each preferredTopics}}{{{this}}} {{/each}}{{else}}None{{/if}}

  Based on this information, recommend a topic and a set of learning modules (vocabulary, grammar, listening, reading, writing) that would be most beneficial for the user. Explain your reasoning for the recommendation.

  Respond in Russian.

  Example output:
  {
    "topic": "Die Familie",
    "modules": ["vocabulary", "grammar", "listening"],
    "reasoning": "Based on your progress, you need to focus on vocabulary and grammar in the context of family. Listening module will help you reinforce new words."
  }
  `,
});

const recommendAiLessonFlow = ai.defineFlow(
  {
    name: 'recommendAiLessonFlow',
    inputSchema: RecommendAiLessonInputSchema,
    outputSchema: RecommendAiLessonOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
