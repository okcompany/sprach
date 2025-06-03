
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

// Define Zod schema for the vocabulary item
const VocabularyItemSchema = z.object({
  german: z.string().describe('The German word or phrase.'),
  russian: z.string().describe('The Russian translation of the word or phrase.'),
  exampleSentence: z.string().optional().describe('An optional example sentence in German using the word/phrase, appropriate for the user\'s level.'),
});

// Define Zod schema for the listening exercise
const ListeningExerciseSchema = z.object({
  script: z.string().describe("The script for the listening exercise, appropriate for the user's level."),
  questions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific comprehension questions about the script, appropriate for the user's level."),
});

// Define Zod schema for the output
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('The title of the generated lesson.'),
  vocabulary: z.array(VocabularyItemSchema).describe('An array of key vocabulary items for the lesson (minimum 5 items), each including the German word/phrase, its Russian translation, and an optional example sentence. Ensure this vocabulary list is based on common German language textbooks for the specified level and topic.'),
  grammarExplanation: z.string().describe('A detailed explanation of a relevant grammar point, appropriate for the user\'s level.'),
  listeningExercise: ListeningExerciseSchema.describe('A listening comprehension exercise including a script and specific questions.'),
  readingPassage: z.string().describe('A short reading passage related to the topic, appropriate for the user\'s level.'),
  readingQuestions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific comprehension questions about the reading passage, appropriate for the user's level."),
  writingPrompt: z.string().describe('A writing prompt for the learner to practice their writing skills, appropriate for the user\'s level.'),
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
  - A lessonTitle field.
  - A vocabulary field which is a list of key vocabulary items (minimum 5 items). Each item must be an object with "german" (the word/phrase), "russian" (its translation), and an optional "exampleSentence" (in German, appropriate for the user's level). Ensure this vocabulary list is based on common German language textbooks for the specified level and topic.
  - A grammarExplanation field which explains a grammar point relevant to the level and topic.
  - A listeningExercise field which must be an object containing:
    - "script": A script for a listening comprehension exercise, appropriate for the user's level.
    - "questions": An array of 1 to 3 specific comprehension questions about the script, also appropriate for the user's level.
  - A readingPassage field which provides a short reading passage related to the topic, appropriate for the user's level.
  - A readingQuestions field which is an array of 1 to 3 specific comprehension questions about the reading passage, appropriate for the user's level.
  - A writingPrompt field which provides a writing prompt for the learner, appropriate for the user's level.

  Ensure that all content is appropriate for the specified level.
`,
});

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;

// Define the flow
const generateLessonContentFlow = ai.defineFlow(
  {
    name: 'generateLessonContentFlow',
    inputSchema: GenerateLessonInputSchema,
    outputSchema: GenerateLessonOutputSchema,
  },
  async input => {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const {output} = await lessonPrompt(input);
        if (!output) {
          throw new Error('AI model returned an empty output during lesson generation.');
        }
        return output;
      } catch (error: any) {
        retries++;
        if (retries >= MAX_RETRIES) {
          console.error(`Failed to generate lesson content after ${MAX_RETRIES} attempts. Last error:`, error);
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
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1); // Exponential backoff
          console.warn(`Lesson generation attempt ${retries} failed with transient error. Retrying in ${delay / 1000}s... Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('Lesson generation failed with non-retryable error:', error);
          throw error;
        }
      }
    }
    throw new Error('Failed to generate lesson content after multiple retries, and loop exited unexpectedly.');
  }
);
