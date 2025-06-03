
// This is an AI-powered German language learning system that generates lessons from A0 to C2.
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating personalized German lessons.
 *
 * The flow takes a user's level and a topic as input and returns a comprehensive lesson plan
 * including various exercise types.
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
  exampleSentence: z.string().optional().describe('An optional example sentence in German using the word/phrase, appropriate for the user\'s level. This should always be provided if possible.'),
});

// Define Zod schema for the listening exercise
const ListeningExerciseSchema = z.object({
  script: z.string().describe("The script for the listening exercise, appropriate for the user's level."),
  questions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific comprehension questions about the script, appropriate for the user's level."),
});

// --- Zod Schemas for Grammar Exercises ---

const FillInTheBlanksQuestionSchema = z.object({
  promptText: z.string().describe("The sentence or text with one or more blanks, clearly indicating where the user should fill in. Include hints in parentheses if helpful, e.g., 'Ich ______ (gehen) gern.' or 'Der Tisch ist ____ (groß)."),
  correctAnswers: z.array(z.string()).min(1).describe("An array of acceptable correct answers for the blank(s)."),
  explanation: z.string().optional().describe("A brief explanation why these answers are correct, if necessary."),
});

const FillInTheBlanksExerciseSchema = z.object({
  type: z.literal("fillInTheBlanks"),
  instructions: z.string().describe("General instructions for this set of fill-in-the-blanks questions, e.g., 'Fill in the correct form of the verb/adjective.'"),
  questions: z.array(FillInTheBlanksQuestionSchema).min(1).max(3).describe("An array of 1 to 3 fill-in-the-blanks questions."),
});

const MultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("The question or sentence with a blank that the user needs to complete by choosing an option."),
  options: z.array(z.string()).min(2).max(4).describe("An array of 2 to 4 options for the user to choose from."),
  correctAnswer: z.string().describe("The exact text of the correct option from the 'options' array."),
  explanation: z.string().optional().describe("A brief explanation why this option is correct, if necessary."),
});

const MultipleChoiceExerciseSchema = z.object({
  type: z.literal("multipleChoice"),
  instructions: z.string().describe("General instructions for this set of multiple-choice questions, e.g., 'Choose the correct option to complete the sentence.'"),
  questions: z.array(MultipleChoiceQuestionSchema).min(1).max(3).describe("An array of 1 to 3 multiple-choice questions."),
});

const SentenceConstructionTaskSchema = z.object({
  words: z.array(z.string()).min(3).describe("An array of words (and punctuation, if any) that the user needs to arrange into a correct sentence."),
  possibleCorrectSentences: z.array(z.string()).min(1).describe("An array of one or more possible correct sentences that can be formed from the given words."),
  explanation: z.string().optional().describe("A brief explanation of the key grammar rule(s) applied, e.g., 'Verb in second position for main clauses.'"),
});

const SentenceConstructionExerciseSchema = z.object({
  type: z.literal("sentenceConstruction"),
  instructions: z.string().describe("General instructions for this set of sentence construction tasks, e.g., 'Form correct sentences using the given words.'"),
  tasks: z.array(SentenceConstructionTaskSchema).min(1).max(3).describe("An array of 1 to 3 sentence construction tasks."),
});

// --- End of Zod Schemas for Grammar Exercises ---


// Define Zod schema for the output
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('The title of the generated lesson.'),
  vocabulary: z.array(VocabularyItemSchema).min(5).describe('An array of at least 5 key vocabulary items for the lesson, each including the German word/phrase, its Russian translation, and an example sentence (if possible). Ensure this vocabulary list is based on common German language textbooks for the specified level and topic.'),
  grammarExplanation: z.string().describe('A detailed explanation of a relevant grammar point, appropriate for the user\'s level.'),
  grammarExercises: z.array(
    z.discriminatedUnion("type", [
      FillInTheBlanksExerciseSchema,
      MultipleChoiceExerciseSchema,
      SentenceConstructionExerciseSchema,
    ])
  ).min(1).max(3).optional().describe('An optional array of 1 to 3 structured grammar exercises related to the grammar point. If provided, it should contain at least one exercise. AI should try to provide these if applicable and diverse.'),
  listeningExercise: ListeningExerciseSchema.describe('A listening comprehension exercise including a script and specific questions.'),
  readingPassage: z.string().describe('A short reading passage related to the topic, appropriate for the user\'s level.'),
  readingQuestions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific comprehension questions about the reading passage, appropriate for the user's level."),
  writingPrompt: z.string().describe('A writing prompt for the learner to practice their writing skills, appropriate for the user\'s level, usually related to the grammar or topic.'),
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

  The lesson MUST include:
  - A "lessonTitle" field.
  - A "vocabulary" field: an array of at least 5 key vocabulary items. Each item MUST be an object with "german" (the word/phrase), "russian" (its translation), and "exampleSentence" (in German, appropriate for the user's level - STRONGLY PREFER to include this). Ensure this vocabulary list is based on common German language textbooks for the specified level and topic.
  - A "grammarExplanation" field: a detailed explanation of a grammar point relevant to the level and topic.
  - An OPTIONAL "grammarExercises" field: If you can create relevant exercises for the grammar point and level, provide an array of 1 to 3 diverse structured grammar exercises. Each exercise object in the array must have a "type" field.
    - If "type" is "fillInTheBlanks":
      Provide "instructions" (e.g., "Fill in the correct form of the verb/adjective.") and a "questions" array (1-3 questions). Each question object needs:
      - "promptText": "The sentence with a blank, e.g., 'Ich ______ (gehen) gern.' Hints are good."
      - "correctAnswers": ["array", "of", "strings"]
      - "explanation": "Optional: Why these answers are correct."
      Example: { "type": "fillInTheBlanks", "instructions": "Fill in the correct verb form.", "questions": [{ "promptText": "Er ______ (lesen) ein Buch.", "correctAnswers": ["liest"], "explanation": "Third person singular present tense."}] }

    - If "type" is "multipleChoice":
      Provide "instructions" (e.g., "Choose the correct option.") and a "questions" array (1-3 questions). Each question object needs:
      - "questionText": "The question or sentence with a blank."
      - "options": ["Option A", "Option B", "Correct Option C"] (2-4 options)
      - "correctAnswer": "The exact text of the correct option."
      - "explanation": "Optional: Why this option is correct."
      Example: { "type": "multipleChoice", "instructions": "Choose the correct article.", "questions": [{ "questionText": "Das ist ____ Tisch.", "options": ["der", "die", "das"], "correctAnswer": "der", "explanation": "Tisch is masculine." }] }

    - If "type" is "sentenceConstruction":
      Provide "instructions" (e.g., "Form correct sentences.") and a "tasks" array (1-3 tasks). Each task object needs:
      - "words": ["array", "of", "words", "to", "arrange", "."]
      - "possibleCorrectSentences": ["One or more", "example correct sentences."]
      - "explanation": "Optional: Key grammar rule applied."
      Example: { "type": "sentenceConstruction", "instructions": "Form a sentence in Perfekt.", "tasks": [{ "words": ["ich", "gestern", "Kino", "ins", "gegangen", "bin", "."], "possibleCorrectSentences": ["Ich bin gestern ins Kino gegangen."], "explanation": "Perfekt tense structure with 'sein'." }] }

  - A "listeningExercise" field which MUST be an object containing:
    - "script": A script for a listening comprehension exercise, appropriate for the user's level.
    - "questions": An array of 1 to 3 specific comprehension questions about the script, also appropriate for the user's level.
  - A "readingPassage" field which provides a short reading passage related to the topic, appropriate for the user's level.
  - A "readingQuestions" field which is an array of 1 to 3 specific comprehension questions about the reading passage, appropriate for the user's level.
  - A "writingPrompt" field which provides a writing prompt for the learner, appropriate for the user's level, ideally related to the grammar point or topic for practice.

  Ensure that ALL content is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For vocabulary, always try to include example sentences. For grammar, try to include exercises if suitable.
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
          throw new Error('[generateLessonContentFlow] AI model returned an empty output during lesson generation.');
        }
        // Ensure vocabulary has at least 5 items, if not, log and potentially retry or pad (for now, just rely on prompt)
        if (output.vocabulary.length < 5) {
            console.warn(`[generateLessonContentFlow] AI returned only ${output.vocabulary.length} vocabulary items for topic "${input.topic}" at level ${input.level}. Expected at least 5.`);
            // Potentially throw error here to trigger retry if strictness is required.
            // For now, we'll allow it but log.
        }
        return output;
      } catch (error: any) {
        retries++;
        if (retries >= MAX_RETRIES) {
          console.error(`[generateLessonContentFlow] Failed after ${MAX_RETRIES} attempts for topic "${input.topic}" at level ${input.level}. Last error:`, error);
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
          console.warn(`[generateLessonContentFlow] Attempt ${retries} failed with transient error for topic "${input.topic}" at level ${input.level}. Retrying in ${delay / 1000}s... Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[generateLessonContentFlow] Failed with non-retryable error for topic "${input.topic}" at level ${input.level}:`, error);
          throw error;
        }
      }
    }
    // This line should ideally not be reached if MAX_RETRIES is handled correctly.
    throw new Error(`[generateLessonContentFlow] Failed after multiple retries for topic "${input.topic}" at level ${input.level}, and loop exited unexpectedly.`);
  }
);

    