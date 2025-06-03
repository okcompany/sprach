
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
  level: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('Learner proficiency (A0-C2).'),
  topic: z.string().describe('Lesson topic (e.g., "Travel", "Food").'),
});

export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// --- Zod Schemas for Vocabulary ---
const VocabularyItemSchema = z.object({
  german: z.string().describe('German word/phrase.'),
  russian: z.string().describe('Russian translation.'),
  exampleSentence: z.string().optional().describe('Optional German example sentence for user level.'),
});

// --- Zod Schemas for Interactive Vocabulary Exercises ---
const AIMatchingPairSchema = z.object({
  german: z.string().describe("German word."),
  russian: z.string().describe("Matching Russian word."),
});

const AIMatchingExerciseSchema = z.object({
  type: z.enum(["matching"]).describe("Exercise type: matching."),
  instructions: z.string().describe("Instructions, e.g., 'Match German to Russian.'"),
  pairs: z.array(AIMatchingPairSchema).min(3).max(8).describe("3-8 word pairs."),
  germanDistractors: z.array(z.string()).optional().describe("Optional German distractors (1-3)."),
  russianDistractors: z.array(z.string()).optional().describe("Optional Russian distractors (1-3)."),
});

const AIAudioQuizItemSchema = z.object({
  germanPhraseToSpeak: z.string().describe("Short German phrase for audio quiz."),
  options: z.array(z.string()).min(3).max(4).describe("3-4 Russian translation options."),
  correctAnswer: z.string().describe("Correct Russian translation from 'options'."),
  explanation: z.string().optional().describe("Brief explanation if needed."),
});

const AIAudioQuizExerciseSchema = z.object({
  type: z.enum(["audioQuiz"]).describe("Exercise type: audio quiz."),
  instructions: z.string().describe("Instructions, e.g., 'Listen and choose translation.'"),
  items: z.array(AIAudioQuizItemSchema).min(2).max(5).describe("2-5 audio quiz items."),
});

const AIVocabularyInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIMatchingExerciseSchema,
  AIAudioQuizExerciseSchema,
]).describe("Interactive vocabulary exercise.");


// --- Zod Schemas for Grammar Exercises ---
const FillInTheBlanksQuestionSchema = z.object({
  promptText: z.string().describe("Sentence with blanks. Hints in ( )."),
  correctAnswers: z.array(z.string()).min(1).describe("Array of correct answers for blank(s)."),
  explanation: z.string().optional().describe("Brief explanation (optional)."),
});

const FillInTheBlanksExerciseSchema = z.object({
  type: z.enum(["fillInTheBlanks"]),
  instructions: z.string().describe("Instructions, e.g., 'Fill in correct form.'"),
  questions: z.array(FillInTheBlanksQuestionSchema).min(1).max(3).describe("1-3 fill-in-the-blanks questions."),
});

const MultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Question or sentence with a blank."),
  options: z.array(z.string()).min(2).max(4).describe("2-4 options to choose from."),
  correctAnswer: z.string().describe("The correct option text."),
  explanation: z.string().optional().describe("Brief explanation (optional)."),
});

const MultipleChoiceExerciseSchema = z.object({
  type: z.enum(["multipleChoice"]),
  instructions: z.string().describe("Instructions, e.g., 'Choose correct option.'"),
  questions: z.array(MultipleChoiceQuestionSchema).min(1).max(3).describe("1-3 multiple-choice questions."),
});

const SentenceConstructionTaskSchema = z.object({
  words: z.array(z.string()).min(3).describe("Array of words to arrange into a sentence."),
  possibleCorrectSentences: z.array(z.string()).min(1).describe("One or more possible correct sentences."),
  explanation: z.string().optional().describe("Brief grammar rule explanation (optional)."),
});

const SentenceConstructionExerciseSchema = z.object({
  type: z.enum(["sentenceConstruction"]),
  instructions: z.string().describe("Instructions, e.g., 'Form correct sentences.'"),
  tasks: z.array(SentenceConstructionTaskSchema).min(1).max(3).describe("1-3 sentence construction tasks."),
});

const AIGrammarExerciseSchema = z.discriminatedUnion("type", [
  FillInTheBlanksExerciseSchema,
  MultipleChoiceExerciseSchema,
  SentenceConstructionExerciseSchema,
]).describe("Structured grammar exercise.");

// --- Zod Schemas for Listening ---
const ListeningExerciseSchema = z.object({
  script: z.string().describe("Listening exercise script for user's level."),
  questions: z.array(z.string()).min(1).max(3).describe("1-3 open-ended comprehension questions about script."),
});

// --- Zod Schemas for Interactive Listening/Reading Exercises (Common Structures) ---
const AIComprehensionMultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Comprehension question for text/script."),
  options: z.array(z.string()).min(2).max(4).describe("2-4 answer options."),
  correctAnswer: z.string().describe("Correct answer text."),
  explanation: z.string().optional().describe("Brief explanation (optional)."),
});

const AIComprehensionMultipleChoiceExerciseSchema = z.object({
  type: z.enum(["comprehensionMultipleChoice"]).describe("Type: multiple choice comprehension."),
  instructions: z.string().describe("Instructions, e.g., 'Read/listen and choose.'"),
  questions: z.array(AIComprehensionMultipleChoiceQuestionSchema).min(1).max(3).describe("1-3 questions."),
});

const AITrueFalseStatementSchema = z.object({
  statement: z.string().describe("Statement about text/script."),
  isTrue: z.boolean().describe("Is statement true? (true/false)."),
  explanation: z.string().optional().describe("Brief explanation (optional)."),
});

const AITrueFalseExerciseSchema = z.object({
  type: z.enum(["trueFalse"]).describe("Type: true/false."),
  instructions: z.string().describe("Instructions, e.g., 'Are statements true or false?'"),
  statements: z.array(AITrueFalseStatementSchema).min(2).max(5).describe("2-5 statements."),
});

const AISequencingExerciseSchema = z.object({
  type: z.enum(["sequencing"]).describe("Type: sequencing events/points."),
  instructions: z.string().describe("Instructions, e.g., 'Order events correctly.'"),
  shuffledItems: z.array(z.string()).min(3).max(6).describe("Shuffled items (events, steps) for user to order."),
  correctOrder: z.array(z.string()).min(3).max(6).describe("Same items in correct sequence."),
});

const AIListeningInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIComprehensionMultipleChoiceExerciseSchema,
  AITrueFalseExerciseSchema,
  AISequencingExerciseSchema,
]).describe("Interactive listening exercise (based on main script).");

const AIReadingInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIComprehensionMultipleChoiceExerciseSchema,
  AITrueFalseExerciseSchema,
  AISequencingExerciseSchema,
]).describe("Interactive reading exercise (based on main passage).");


// --- Zod Schemas for Interactive Writing Exercises ---
const AIStructuredWritingExerciseSchema = z.object({
  type: z.enum(["structuredWriting"]).describe("Type: structured writing task."),
  instructions: z.string().describe("General task instructions."),
  promptDetails: z.string().describe("Task details, e.g., 'Write an email...' or 'Describe this story...'"),
  templateOutline: z.array(z.string()).optional().describe("Optional template/structure (e.g., ['Salutation:', 'Body:', 'Closing:'])."),
  requiredVocabulary: z.array(z.string()).optional().describe("Optional vocabulary list to use."),
  aiGeneratedStoryToDescribe: z.string().optional().describe("Optional AI-generated story text if task is to describe it."),
});

const AIWritingInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIStructuredWritingExerciseSchema,
]).describe("Interactive writing exercise.");


// --- Define Zod schema for the MAIN output ---
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('Generated lesson title.'),
  vocabulary: z.array(VocabularyItemSchema).min(5).describe('At least 5 key vocabulary items (German, Russian, optional example). Common phrases/idioms for level/topic.'),
  grammarExplanation: z.string().describe('Detailed grammar explanation for user level. Focus on verbs for A0-B2.'),
  grammarExercises: z.array(AIGrammarExerciseSchema)
    .min(1).max(3).optional().describe('Optional 1-3 diverse structured grammar exercises. Practice verb conjugations etc.'),
  
  listeningExercise: ListeningExerciseSchema.describe('Listening comprehension (script, open questions).'),
  readingPassage: z.string().describe('Short reading passage for user level.'),
  readingQuestions: z.array(z.string()).min(1).max(3).describe("1-3 open-ended comprehension questions for passage."),
  
  writingPrompt: z.string().describe('General writing prompt for user level, related to grammar/topic.'),

  interactiveVocabularyExercises: z.array(AIVocabularyInteractiveExerciseSchema).optional().describe("Optional 1-2 interactive vocab exercises (matching, audio quiz)."),
  interactiveListeningExercises: z.array(AIListeningInteractiveExerciseSchema).optional().describe("Optional 1-2 interactive listening exercises (MCQ, T/F, sequence) based on main script."),
  interactiveReadingExercises: z.array(AIReadingInteractiveExerciseSchema).optional().describe("Optional 1-2 interactive reading exercises (MCQ, T/F, sequence) based on main passage."),
  interactiveWritingExercises: z.array(AIWritingInteractiveExerciseSchema).optional().describe("Optional 1 structured writing task (e.g., email by template). Can replace general 'writingPrompt'."),
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

  The lesson MUST include the following core components:
  - "lessonTitle": A suitable title.
  - "vocabulary": An array of at least 5 key vocabulary items (German, Russian translation, and strongly prefer an exampleSentence in German). Include common conversational phrases and idioms relevant to the topic and level.
  - "grammarExplanation": A detailed explanation of a grammar point relevant to the level and topic. For levels A0-B2, systematically try to include grammar topics related to verbs (tenses, modals, reflexives, common strong/irregular verbs, word order with verbs, etc.).
  - "listeningExercise": An object with "script" (German, appropriate for the level) and "questions" (1-3 open-ended comprehension questions about the script in Russian or German based on what user is expected to answer in).
  - "readingPassage": A short reading passage in German related to the topic, appropriate for the level.
  - "readingQuestions": An array of 1-3 open-ended comprehension questions about the reading passage.
  - "writingPrompt": A general writing prompt for the learner.

  Additionally, you MAY provide OPTIONAL structured and interactive exercises as described below. Aim for 1-2 interactive exercises per relevant module if appropriate for the topic and level. These exercises should complement the core components.

  1. OPTIONAL "grammarExercises":
     If you can create relevant exercises for the "grammarExplanation", provide an array of 1 to 3 diverse structured grammar exercises. Each exercise object in the array must have a "type" field ("fillInTheBlanks", "multipleChoice", or "sentenceConstruction").
     - If "type" is "fillInTheBlanks":
       Provide "instructions" (e.g., "Fill in the correct form of the verb/adjective.") and a "questions" array (1-3 questions). Each question object needs: "promptText", "correctAnswers" (array of strings), "explanation" (optional).
       Example: { "type": "fillInTheBlanks", "instructions": "Fill in the correct verb form.", "questions": [{ "promptText": "Er ______ (lesen) ein Buch.", "correctAnswers": ["liest"], "explanation": "Third person singular present tense."}] }
     - If "type" is "multipleChoice":
       Provide "instructions" (e.g., "Choose the correct option.") and a "questions" array (1-3 questions). Each question object needs: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
       Example: { "type": "multipleChoice", "instructions": "Choose the correct article.", "questions": [{ "questionText": "Das ist ____ Tisch.", "options": ["der", "die", "das"], "correctAnswer": "der", "explanation": "Tisch is masculine." }] }
     - If "type" is "sentenceConstruction":
       Provide "instructions" (e.g., "Form correct sentences.") and a "tasks" array (1-3 tasks). Each task object needs: "words" (array of strings to arrange), "possibleCorrectSentences" (array of strings), "explanation" (optional).
       Example: { "type": "sentenceConstruction", "instructions": "Form a sentence in Perfekt.", "tasks": [{ "words": ["ich", "gestern", "Kino", "ins", "gegangen", "bin", "."], "possibleCorrectSentences": ["Ich bin gestern ins Kino gegangen."], "explanation": "Perfekt tense structure with 'sein'." }] }

  2. OPTIONAL "interactiveVocabularyExercises": An array of 1-2 exercises. Each exercise object in the array must have a "type" field ("matching" or "audioQuiz").
     - If "type" is "matching":
       Provide "instructions", "pairs" (array of {german, russian}, 3-8 pairs), "germanDistractors" (optional, 1-3 strings), "russianDistractors" (optional, 1-3 strings).
       Example: { "type": "matching", "instructions": "Сопоставьте слова.", "pairs": [{"german": "Apfel", "russian": "яблоко"}, ...], "germanDistractors": ["Birne"] }
     - If "type" is "audioQuiz":
       Provide "instructions", "items" (array of 2-5 items). Each item: "germanPhraseToSpeak", "options" (3-4 Russian translations), "correctAnswer" (string), "explanation" (optional).
       Example: { "type": "audioQuiz", "instructions": "Прослушайте и выберите перевод.", "items": [{"germanPhraseToSpeak": "Wie geht es Ihnen?", "options": ["Как дела?", "Сколько это стоит?", "Где туалет?"], "correctAnswer": "Как дела?"}] }

  3. OPTIONAL "interactiveListeningExercises": An array of 1-2 exercises. These exercises should be based on the main "listeningExercise.script". Each exercise object in the array must have a "type" field ("comprehensionMultipleChoice", "trueFalse", or "sequencing").
     - If "type" is "comprehensionMultipleChoice": (Based on "listeningExercise.script")
       Provide "instructions", "questions" (array of 1-3). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - If "type" is "trueFalse": (Based on "listeningExercise.script")
       Provide "instructions", "statements" (array of 2-5). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - If "type" is "sequencing": (Based on "listeningExercise.script")
       Provide "instructions", "shuffledItems" (array of 3-6 strings from the script, out of order), "correctOrder" (array of same strings in correct order).

  4. OPTIONAL "interactiveReadingExercises": An array of 1-2 exercises. These exercises should be based on the main "readingPassage". Each exercise object in the array must have a "type" field ("comprehensionMultipleChoice", "trueFalse", or "sequencing").
     - If "type" is "comprehensionMultipleChoice": (Based on "readingPassage")
       Provide "instructions", "questions" (array of 1-3). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - If "type" is "trueFalse": (Based on "readingPassage")
       Provide "instructions", "statements" (array of 2-5). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - If "type" is "sequencing": (Based on "readingPassage")
       Provide "instructions", "shuffledItems" (array of 3-6 strings/sentences from the passage, out of order), "correctOrder" (array of same strings in correct order).

  5. OPTIONAL "interactiveWritingExercises": An array of 1 exercise. This can complement or replace the general "writingPrompt". The exercise object must have a "type" field ("structuredWriting").
     - If "type" is "structuredWriting":
       Provide "instructions", "promptDetails" (e.g., task description like "Write an email..."), "templateOutline" (optional, array of strings like "Anrede:", "Gruß:"), "requiredVocabulary" (optional, array of strings), "aiGeneratedStoryToDescribe" (optional, if the task is to describe a provided story).
       Example: { "type": "structuredWriting", "instructions": "Напишите email.", "promptDetails": "Пригласите друга на день рождения.", "templateOutline": ["Liebe/r [Имя],", "ich möchte dich herzlich einladen...", "Viele Grüße,"], "requiredVocabulary": ["Party", "Geschenk", "feiern"] }

  Ensure that ALL content, including all parts of interactive exercises, is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For vocabulary, always try to include example sentences and conversational phrases. For grammar, try to include exercises if suitable, focusing on core concepts like verb usage.
  The main components ("vocabulary", "grammarExplanation", "listeningExercise", "readingPassage", "readingQuestions", "writingPrompt") are mandatory. The interactive exercise arrays are optional enhancements.
`,
});

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 3000;

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
        if (output.vocabulary.length < 5) {
            console.warn(`[generateLessonContentFlow] AI returned only ${output.vocabulary.length} vocabulary items for topic "${input.topic}" at level ${input.level}. Expected at least 5.`);
        }
        return output;
      } catch (error: any) {
        retries++;
        console.error(`[generateLessonContentFlow] Attempt ${retries} for topic "${input.topic}" level ${input.level} FAILED. Error:`, error.message ? error.message : error);
        if (retries >= MAX_RETRIES) {
          console.error(`[generateLessonContentFlow] All ${MAX_RETRIES} retries FAILED for input:`, JSON.stringify(input, null, 2), "Last error:", error.message ? error.message : error);
          throw error;
        }
        
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        if (
          errorMessage.includes('503') || // Standard service unavailable
          errorMessage.includes('service unavailable') || // More explicit
          errorMessage.includes('model is overloaded') || // Specific to AI models
          errorMessage.includes('server error') || // General server-side issue
          errorMessage.includes('internal error') || // General internal issue
          (error.status === 400 && errorMessage.includes('constraint that has too many states')) // Specific schema error NOT to retry indefinitely
        ) {
            // For "too many states" (400), we don't want to retry repeatedly like a 503. 
            // This error indicates a problem with the schema itself.
            // However, the loop structure handles MAX_RETRIES for all listed conditions.
            // If it's the schema error, it will fail MAX_RETRIES and then throw, which is appropriate.
            // If it's a transient 503, it will retry.
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1);
          console.warn(`[generateLessonContentFlow] Attempt ${retries} failed for topic "${input.topic}" at level ${input.level} (Error: ${error.message ? error.message.split('\n')[0] : 'Unknown'}). Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable errors (or errors not explicitly listed for retry)
          console.error(`[generateLessonContentFlow] Failed with non-retryable error for topic "${input.topic}" at level ${input.level}. Input:`, JSON.stringify(input, null, 2), "Error:", error.message ? error.message : error);
          throw error;
        }
      }
    }
    throw new Error(`[generateLessonContentFlow] Failed after multiple retries for topic "${input.topic}" at level ${input.level}, and loop exited unexpectedly.`);
  }
);

