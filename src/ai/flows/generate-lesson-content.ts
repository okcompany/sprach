// This is an AI-powered German language learning system that generates lessons from A0 to C2.
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating personalized German lessons.
 *
 * The flow takes a user's level and a topic as input and returns a comprehensive lesson plan.
 *
 * @module generateLessonContent
 * @param {GenerateLessonInput} input - The input data for the flow, including the user's level and chosen topic.
 * @returns {Promise<GenerateLessonOutput>} - A promise that resolves with the generated lesson content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define Zod schema for the input
const GenerateLessonInputSchema = z.object({
  level: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('The learner\'s current German proficiency level (A0-C2).'),
  topic: z.string().describe('The topic for the lesson (e.g., "Travel", "Food", "Technology").'),
});

export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// Define Zod schema for the output
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('The title of the generated lesson.'),
  vocabulary: z.array(z.string()).describe('An array of key vocabulary words for the lesson.'),
  grammarExplanation: z.string().describe('A detailed explanation of a relevant grammar point.'),
  listeningExercise: z.string().describe('A description or script for a listening comprehension exercise.'),
  readingPassage: z.string().describe('A short reading passage related to the topic.'),
  writingPrompt: z.string().describe('A writing prompt for the learner to practice their writing skills.'),
});

export type GenerateLessonOutput = z.infer<typeof GenerateLessonOutputSchema>;

export async function generateLessonContent(input: GenerateLessonInput): Promise<GenerateLessonOutput> {
  return generateLessonContentFlow(input);
}

// Define the prompt
const lessonPrompt = ai.definePrompt({
  name: 'lessonPrompt',
  input: {schema: GenerateLessonInputSchema},
  output: {schema: GenerateLessonOutputSchema},
  prompt: `You are an expert German language teacher. Generate a comprehensive German lesson for a student.

  The student is at level: {{{level}}}
  The topic is: {{{topic}}}

  The lesson should include:
  - A lessonTitle field
  - A vocabulary field which is a list of key vocabulary words (minimum 5 words) relevant to the topic.
  - A grammarExplanation field which explains a grammar point relevant to the level and topic.
  - A listeningExercise field which describes a listening comprehension exercise.
  - A readingPassage field which provides a short reading passage related to the topic.
  - A writingPrompt field which provides a writing prompt for the learner.

  Ensure that all content is appropriate for the specified level.
`,
});

// Define the flow
const generateLessonContentFlow = ai.defineFlow(
  {
    name: 'generateLessonContentFlow',
    inputSchema: GenerateLessonInputSchema,
    outputSchema: GenerateLessonOutputSchema,
  },
  async input => {
    const {output} = await lessonPrompt(input);
    return output!;
  }
);
