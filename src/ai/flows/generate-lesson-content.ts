
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
  level: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('Level (A0-C2).'),
  topic: z.string().describe('Lesson topic (e.g., "Travel").'),
});

export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// --- Zod Schemas for Vocabulary ---
const VocabularyItemSchema = z.object({
  german: z.string().describe('German word.'),
  russian: z.string().describe('Russian translation.'),
  exampleSentence: z.string().optional().describe('Opt. German example.'),
});

// --- Zod Schemas for Interactive Vocabulary Exercises ---
const AIMatchingPairSchema = z.object({
  german: z.string().describe("German word."),
  russian: z.string().describe("Matching Russian."),
});

const AIMatchingExerciseSchema = z.object({
  type: z.enum(["matching"]).describe("Type: matching."),
  instructions: z.string().describe("Instructions, e.g., 'Match words.'"),
  pairs: z.array(AIMatchingPairSchema).min(3).max(6).describe("3-6 pairs."),
  germanDistractors: z.array(z.string()).optional().describe("Opt. German distractors (1-2)."),
  russianDistractors: z.array(z.string()).optional().describe("Opt. Russian distractors (1-2)."),
});

const AIAudioQuizItemSchema = z.object({
  germanPhraseToSpeak: z.string().describe("Short German phrase for audio."),
  options: z.array(z.string()).min(3).max(4).describe("3-4 Russian options."),
  correctAnswer: z.string().describe("Correct Russian option."),
  explanation: z.string().optional().describe("Brief explanation opt."),
});

const AIAudioQuizExerciseSchema = z.object({
  type: z.enum(["audioQuiz"]).describe("Type: audio quiz."),
  instructions: z.string().describe("Instructions, e.g., 'Listen & choose.'"),
  items: z.array(AIAudioQuizItemSchema).min(2).max(4).describe("2-4 audio items."),
});

// --- Zod Schemas for Grammar Exercises ---
const FillInTheBlanksQuestionSchema = z.object({
  promptText: z.string().describe("Sentence w/ blanks. Hints in ()."),
  correctAnswers: z.array(z.string()).min(1).describe("Correct answer(s)."),
  explanation: z.string().optional().describe("Explanation opt."),
});

const FillInTheBlanksExerciseSchema = z.object({
  type: z.enum(["fillInTheBlanks"]),
  instructions: z.string().describe("Instructions, e.g., 'Fill blanks.'"),
  questions: z.array(FillInTheBlanksQuestionSchema).min(1).max(2).describe("1-2 fill-blank questions."),
});

const MultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Question/sentence w/ blank."),
  options: z.array(z.string()).min(2).max(4).describe("2-4 choices."),
  correctAnswer: z.string().describe("Correct option."),
  explanation: z.string().optional().describe("Explanation opt."),
});

const MultipleChoiceExerciseSchema = z.object({
  type: z.enum(["multipleChoice"]),
  instructions: z.string().describe("Instructions, e.g., 'Choose option.'"),
  questions: z.array(MultipleChoiceQuestionSchema).min(1).max(2).describe("1-2 MCQ questions."),
});

const SentenceConstructionTaskSchema = z.object({
  words: z.array(z.string()).min(3).describe("Words to arrange."),
  possibleCorrectSentences: z.array(z.string()).min(1).describe("Correct sentence(s)."),
  explanation: z.string().optional().describe("Grammar rule opt."),
});

const SentenceConstructionExerciseSchema = z.object({
  type: z.enum(["sentenceConstruction"]),
  instructions: z.string().describe("Instructions, e.g., 'Form sentences.'"),
  tasks: z.array(SentenceConstructionTaskSchema).min(1).max(2).describe("1-2 sentence tasks."),
});

const AIGrammarExerciseSchema = z.discriminatedUnion("type", [
  FillInTheBlanksExerciseSchema,
  MultipleChoiceExerciseSchema,
  SentenceConstructionExerciseSchema,
]).describe("Structured grammar exercise.");

// --- Zod Schemas for Listening ---
const ListeningExerciseSchema = z.object({
  script: z.string().describe("Listening script for level."),
  questions: z.array(z.string()).min(1).max(2).describe("1-2 open comprehension questions."),
});

// --- Zod Schemas for Interactive Listening/Reading Exercises (Common Structures) ---
const AIComprehensionMultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Comprehension question."),
  options: z.array(z.string()).min(2).max(4).describe("2-4 answer options."),
  correctAnswer: z.string().describe("Correct answer."),
  explanation: z.string().optional().describe("Explanation opt."),
});

const AIComprehensionMultipleChoiceExerciseSchema = z.object({
  type: z.enum(["comprehensionMultipleChoice"]).describe("Type: MCQ comprehension."),
  instructions: z.string().describe("Instructions, e.g., 'Read/listen & choose.'"),
  questions: z.array(AIComprehensionMultipleChoiceQuestionSchema).min(1).max(2).describe("1-2 questions."),
});

const AITrueFalseStatementSchema = z.object({
  statement: z.string().describe("Statement for T/F."),
  isTrue: z.boolean().describe("Is statement true?"),
  explanation: z.string().optional().describe("Explanation opt."),
});

const AITrueFalseExerciseSchema = z.object({
  type: z.enum(["trueFalse"]).describe("Type: true/false."),
  instructions: z.string().describe("Instructions, e.g., 'T/F statements?'"),
  statements: z.array(AITrueFalseStatementSchema).min(2).max(4).describe("2-4 statements."),
});

const AISequencingExerciseSchema = z.object({
  type: z.enum(["sequencing"]).describe("Type: sequencing."),
  instructions: z.string().describe("Instructions, e.g., 'Order events.'"),
  shuffledItems: z.array(z.string()).min(3).max(5).describe("Shuffled items to order."),
  correctOrder: z.array(z.string()).min(3).max(5).describe("Items in correct sequence."),
});

// --- Define Zod schema for the MAIN output ---
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('Generated lesson title.'),
  vocabulary: z.array(VocabularyItemSchema).min(5).describe('Min 5 key vocab items (German, Russian, opt. example). Phrases/idioms for level/topic.'),
  grammarExplanation: z.string().describe('Detailed grammar explanation. Focus on verbs A0-B2.'),
  grammarExercise: AIGrammarExerciseSchema.optional().describe('Opt. ONE diverse structured grammar exercise. Practice verbs etc.'),
  
  listeningExercise: ListeningExerciseSchema.describe('Listening (script, open questions).'),
  readingPassage: z.string().describe('Short reading passage for level.'),
  readingQuestions: z.array(z.string()).min(1).max(2).describe("1-2 open reading questions."),
  
  writingPrompt: z.string().describe('General writing prompt for level/topic.'),

  // Interactive Vocabulary (Split)
  interactiveMatchingExercise: AIMatchingExerciseSchema.optional().describe("Opt. ONE matching vocab exercise."),
  interactiveAudioQuizExercise: AIAudioQuizExerciseSchema.optional().describe("Opt. ONE audio quiz vocab exercise."),

  // Interactive Listening (Split)
  interactiveListeningMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Opt. ONE MCQ listening exercise for main script."),
  interactiveListeningTrueFalse: AITrueFalseExerciseSchema.optional().describe("Opt. ONE True/False listening exercise for main script."),
  interactiveListeningSequencing: AISequencingExerciseSchema.optional().describe("Opt. ONE sequencing listening exercise for main script."),
  
  // Interactive Reading (Split)
  interactiveReadingMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Opt. ONE MCQ reading exercise for main passage."),
  interactiveReadingTrueFalse: AITrueFalseExerciseSchema.optional().describe("Opt. ONE True/False reading exercise for main passage."),
  interactiveReadingSequencing: AISequencingExerciseSchema.optional().describe("Opt. ONE sequencing reading exercise for main passage."),

  // Interactive Writing is temporarily removed to reduce schema complexity.
  // interactiveWritingExercise: AIWritingInteractiveExerciseSchema.optional().describe("Opt. ONE structured writing task (e.g., email). Can replace 'writingPrompt'."),
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
  - "listeningExercise": An object with "script" (German, appropriate for the level) and "questions" (1-2 open-ended comprehension questions about the script in Russian or German based on what user is expected to answer in).
  - "readingPassage": A short reading passage in German related to the topic, appropriate for the level.
  - "readingQuestions": An array of 1-2 open-ended comprehension questions about the reading passage.
  - "writingPrompt": A general writing prompt for the learner.

  Additionally, you MAY provide OPTIONAL structured and interactive exercises as described below.
  For each interactive section (vocabulary, listening, reading), you may provide AT MOST ONE type of exercise if appropriate for the topic and level. These exercises should complement the core components.

  1. OPTIONAL "grammarExercise":
     If you can create a relevant exercise for the "grammarExplanation", provide ONE structured grammar exercise. The exercise object must have a "type" field ("fillInTheBlanks", "multipleChoice", or "sentenceConstruction").
     - If "type" is "fillInTheBlanks":
       Provide "instructions" (e.g., "Fill in the correct form.") and a "questions" array (1-2 questions). Each question object needs: "promptText", "correctAnswers" (array of strings), "explanation" (optional).
     - If "type" is "multipleChoice":
       Provide "instructions" (e.g., "Choose the correct option.") and a "questions" array (1-2 questions). Each question object needs: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - If "type" is "sentenceConstruction":
       Provide "instructions" (e.g., "Form correct sentences.") and a "tasks" array (1-2 tasks). Each task object needs: "words" (array of strings to arrange), "possibleCorrectSentences" (array of strings), "explanation" (optional).

  2. OPTIONAL Interactive Vocabulary Exercises: Provide AT MOST ONE of the following:
     - "interactiveMatchingExercise":
       Provide "instructions", "pairs" (array of {german, russian}, 3-6 pairs), "germanDistractors" (optional, 1-2 strings), "russianDistractors" (optional, 1-2 strings).
     - "interactiveAudioQuizExercise":
       Provide "instructions", "items" (array of 2-4 items). Each item: "germanPhraseToSpeak", "options" (3-4 Russian translations), "correctAnswer" (string), "explanation" (optional).

  3. OPTIONAL Interactive Listening Exercises: Provide AT MOST ONE of the following. This exercise should be based on the main "listeningExercise.script".
     - "interactiveListeningMCQ": (Based on "listeningExercise.script")
       Provide "instructions", "questions" (array of 1-2). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - "interactiveListeningTrueFalse": (Based on "listeningExercise.script")
       Provide "instructions", "statements" (array of 2-4). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - "interactiveListeningSequencing": (Based on "listeningExercise.script")
       Provide "instructions", "shuffledItems" (array of 3-5 strings from the script, out of order), "correctOrder" (array of same strings in correct order).

  4. OPTIONAL Interactive Reading Exercises: Provide AT MOST ONE of the following. This exercise should be based on the main "readingPassage".
     - "interactiveReadingMCQ": (Based on "readingPassage")
       Provide "instructions", "questions" (array of 1-2). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - "interactiveReadingTrueFalse": (Based on "readingPassage")
       Provide "instructions", "statements" (array of 2-4). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - "interactiveReadingSequencing": (Based on "readingPassage")
       Provide "instructions", "shuffledItems" (array of 3-5 strings/sentences from the passage, out of order), "correctOrder" (array of same strings in correct order).

  Ensure that ALL content, including all parts of interactive exercises, is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For vocabulary, always try to include example sentences and conversational phrases. For grammar, try to include an exercise if suitable, focusing on core concepts like verb usage.
  The main components ("vocabulary", "grammarExplanation", "listeningExercise", "readingPassage", "readingQuestions", "writingPrompt") are mandatory. The interactive exercise fields are optional single-object enhancements.
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
          errorMessage.includes('503') || 
          errorMessage.includes('service unavailable') || 
          errorMessage.includes('model is overloaded') || 
          errorMessage.includes('server error') || 
          errorMessage.includes('internal error') ||
          (error.status === 400 && errorMessage.includes('constraint that has too many states')) 
        ) {
            
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1);
          console.warn(`[generateLessonContentFlow] Attempt ${retries} failed for topic "${input.topic}" at level ${input.level} (Error: ${error.message ? error.message.split('\n')[0] : 'Unknown'}). Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[generateLessonContentFlow] Failed with non-retryable error for topic "${input.topic}" at level ${input.level}. Input:`, JSON.stringify(input, null, 2), "Error:", error.message ? error.message : error);
          throw error;
        }
      }
    }
    throw new Error(`[generateLessonContentFlow] Failed after multiple retries for topic "${input.topic}" at level ${input.level}, and loop exited unexpectedly.`);
  }
);

