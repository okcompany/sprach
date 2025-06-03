
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

// --- Zod Schemas for Vocabulary ---
const VocabularyItemSchema = z.object({
  german: z.string().describe('The German word or phrase.'),
  russian: z.string().describe('The Russian translation of the word or phrase.'),
  exampleSentence: z.string().optional().describe('An optional example sentence in German using the word/phrase, appropriate for the user\'s level. This should always be provided if possible.'),
});

// --- Zod Schemas for Interactive Vocabulary Exercises ---
const AIMatchingPairSchema = z.object({
  german: z.string().describe("Немецкое слово или фраза."),
  russian: z.string().describe("Соответствующее русское слово или фраза."),
});

const AIMatchingExerciseSchema = z.object({
  type: z.literal("matching").describe("Тип упражнения: сопоставление."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Сопоставьте немецкие слова с их русскими переводами.'"),
  pairs: z.array(AIMatchingPairSchema).min(3).max(8).describe("Массив из 3-8 пар слов для сопоставления."),
  germanDistractors: z.array(z.string()).optional().describe("Опциональный массив немецких слов-дистракторов (1-3) для усложнения."),
  russianDistractors: z.array(z.string()).optional().describe("Опциональный массив русских слов-дистракторов (1-3) для усложнения."),
});

const AIAudioQuizItemSchema = z.object({
  germanPhraseToSpeak: z.string().describe("Немецкая фраза, которую пользователь должен прослушать. Она должна быть относительно короткой и ясной для уровня."),
  options: z.array(z.string()).min(3).max(4).describe("Массив из 3-4 вариантов ответа на русском языке (переводы)."),
  correctAnswer: z.string().describe("Правильный русский перевод из списка 'options'."),
  explanation: z.string().optional().describe("Краткое пояснение, если необходимо (например, если есть похожие варианты)."),
});

const AIAudioQuizExerciseSchema = z.object({
  type: z.literal("audioQuiz").describe("Тип упражнения: аудио-квиз."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Прослушайте фразу и выберите правильный перевод.'"),
  items: z.array(AIAudioQuizItemSchema).min(2).max(5).describe("Массив из 2-5 аудио-заданий."),
});

const AIVocabularyInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIMatchingExerciseSchema,
  AIAudioQuizExerciseSchema,
]).describe("Интерактивное упражнение для модуля лексики.");


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

const AIGrammarExerciseSchema = z.discriminatedUnion("type", [
  FillInTheBlanksExerciseSchema,
  MultipleChoiceExerciseSchema,
  SentenceConstructionExerciseSchema,
]).describe("Структурированное упражнение для грамматического модуля.");

// --- Zod Schemas for Listening ---
const ListeningExerciseSchema = z.object({
  script: z.string().describe("The script for the listening exercise, appropriate for the user's level."),
  questions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific open-ended comprehension questions about the script, appropriate for the user's level."),
});

// --- Zod Schemas for Interactive Listening/Reading Exercises (Common Structures) ---
const AIComprehensionMultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Вопрос на понимание текста/скрипта."),
  options: z.array(z.string()).min(2).max(4).describe("Массив из 2-4 вариантов ответа."),
  correctAnswer: z.string().describe("Текст правильного варианта ответа."),
  explanation: z.string().optional().describe("Краткое объяснение, почему этот ответ верный."),
});

const AIComprehensionMultipleChoiceExerciseSchema = z.object({
  type: z.literal("comprehensionMultipleChoice").describe("Тип: множественный выбор на понимание."),
  instructions: z.string().describe("Инструкции, например, 'Прочитайте/прослушайте и выберите правильный ответ.'"),
  questions: z.array(AIComprehensionMultipleChoiceQuestionSchema).min(1).max(3).describe("Массив из 1-3 вопросов."),
});

const AITrueFalseStatementSchema = z.object({
  statement: z.string().describe("Утверждение по тексту/скрипту."),
  isTrue: z.boolean().describe("Верно ли утверждение (true/false)."),
  explanation: z.string().optional().describe("Краткое объяснение, почему утверждение верное или неверное, если необходимо."),
});

const AITrueFalseExerciseSchema = z.object({
  type: z.literal("trueFalse").describe("Тип: верно/неверно."),
  instructions: z.string().describe("Инструкции, например, 'Определите, верны ли следующие утверждения.'"),
  statements: z.array(AITrueFalseStatementSchema).min(2).max(5).describe("Массив из 2-5 утверждений."),
});

const AISequencingExerciseSchema = z.object({
  type: z.literal("sequencing").describe("Тип: упорядочивание событий/пунктов."),
  instructions: z.string().describe("Инструкции, например, 'Расположите события в правильном порядке согласно тексту/аудио.'"),
  // Items are provided by AI in a shuffled manner, user has to reorder.
  shuffledItems: z.array(z.string()).min(3).max(6).describe("Элементы (события, шаги, пункты из текста/аудио) в случайном порядке, которые пользователь должен упорядочить."),
  correctOrder: z.array(z.string()).min(3).max(6).describe("Те же элементы, что и в 'shuffledItems', но в правильной последовательности согласно тексту/аудиоскрипту."),
});

const AIListeningInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIComprehensionMultipleChoiceExerciseSchema,
  AITrueFalseExerciseSchema,
  AISequencingExerciseSchema,
]).describe("Интерактивное упражнение для модуля аудирования, основанное на основном скрипте аудирования.");

const AIReadingInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIComprehensionMultipleChoiceExerciseSchema,
  AITrueFalseExerciseSchema,
  AISequencingExerciseSchema,
]).describe("Интерактивное упражнение для модуля чтения, основанное на основном тексте для чтения.");


// --- Zod Schemas for Interactive Writing Exercises ---
const AIStructuredWritingExerciseSchema = z.object({
  type: z.literal("structuredWriting").describe("Тип: структурированное письменное задание."),
  instructions: z.string().describe("Общие инструкции для задания."),
  promptDetails: z.string().describe("Детали задания, например, 'Напишите email другу, приглашая его на день рождения. Укажите когда и где.' или 'Опишите эту историю, используя следующие слова: ...'"),
  templateOutline: z.array(z.string()).optional().describe("Опциональный шаблон/структура, которую пользователь должен заполнить или которой следовать (например, ['Anrede:', 'Einleitung:', 'Hauptteil:', 'Schluss:', 'Gruß:'])."),
  requiredVocabulary: z.array(z.string()).optional().describe("Опциональный список слов или фраз, которые пользователь должен постараться использовать в своем тексте."),
  aiGeneratedStoryToDescribe: z.string().optional().describe("Если задание - описать историю, здесь будет сама история (короткий текст), сгенерированная ИИ."),
});

const AIWritingInteractiveExerciseSchema = z.discriminatedUnion("type", [
  AIStructuredWritingExerciseSchema,
]).describe("Интерактивное упражнение для модуля письма.");


// --- Define Zod schema for the MAIN output ---
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('The title of the generated lesson.'),
  vocabulary: z.array(VocabularyItemSchema).min(5).describe('An array of at least 5 key vocabulary items for the lesson, each including the German word/phrase, its Russian translation, and an example sentence (if possible). Ensure this vocabulary list is based on common German language textbooks for the specified level and topic. Include common conversational phrases and idioms relevant to the topic and level.'),
  grammarExplanation: z.string().describe('A detailed explanation of a relevant grammar point, appropriate for the user\'s level. Systematically include topics related to verbs (tenses, modals, reflexives etc.) especially for A0-B2 levels.'),
  grammarExercises: z.array(AIGrammarExerciseSchema)
    .min(1).max(3).optional().describe('An optional array of 1 to 3 structured grammar exercises related to the grammar point. If provided, it should contain at least one exercise. AI should try to provide these if applicable and diverse. Ensure exercises help practice verb conjugations and other core grammar concepts.'),
  
  // Standard Listening and Reading
  listeningExercise: ListeningExerciseSchema.describe('A listening comprehension exercise including a script and specific open-ended questions.'),
  readingPassage: z.string().describe('A short reading passage related to the topic, appropriate for the user\'s level.'),
  readingQuestions: z.array(z.string()).min(1).max(3).describe("An array of 1 to 3 specific open-ended comprehension questions about the reading passage, appropriate for the user's level."),
  
  // Standard Writing
  writingPrompt: z.string().describe('A writing prompt for the learner to practice their writing skills, appropriate for the user\'s level, usually related to the grammar or topic. This can be a general prompt.'),

  // NEW OPTIONAL INTERACTIVE EXERCISES
  interactiveVocabularyExercises: z.array(AIVocabularyInteractiveExerciseSchema).optional().describe("Опциональный массив (1-2) интерактивных упражнений для закрепления лексики (сопоставление, аудио-квиз)."),
  interactiveListeningExercises: z.array(AIListeningInteractiveExerciseSchema).optional().describe("Опциональный массив (1-2) интерактивных упражнений на понимание основного скрипта аудирования (множественный выбор, верно/неверно, упорядочивание)."),
  interactiveReadingExercises: z.array(AIReadingInteractiveExerciseSchema).optional().describe("Опциональный массив (1-2) интерактивных упражнений на понимание основного текста для чтения (множественный выбор, верно/неверно, упорядочивание)."),
  interactiveWritingExercises: z.array(AIWritingInteractiveExerciseSchema).optional().describe("Опциональный массив (1) более структурированных письменных заданий (например, email по шаблону, описание истории). Это может дополнять или заменять общий 'writingPrompt', если предоставлено."),
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
     If you can create relevant exercises for the "grammarExplanation", provide an array of 1 to 3 diverse structured grammar exercises. Each exercise object in the array must have a "type" field.
     - If "type" is "fillInTheBlanks":
       Provide "instructions" (e.g., "Fill in the correct form of the verb/adjective.") and a "questions" array (1-3 questions). Each question object needs: "promptText", "correctAnswers" (array of strings), "explanation" (optional).
       Example: { "type": "fillInTheBlanks", "instructions": "Fill in the correct verb form.", "questions": [{ "promptText": "Er ______ (lesen) ein Buch.", "correctAnswers": ["liest"], "explanation": "Third person singular present tense."}] }
     - If "type" is "multipleChoice":
       Provide "instructions" (e.g., "Choose the correct option.") and a "questions" array (1-3 questions). Each question object needs: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
       Example: { "type": "multipleChoice", "instructions": "Choose the correct article.", "questions": [{ "questionText": "Das ist ____ Tisch.", "options": ["der", "die", "das"], "correctAnswer": "der", "explanation": "Tisch is masculine." }] }
     - If "type" is "sentenceConstruction":
       Provide "instructions" (e.g., "Form correct sentences.") and a "tasks" array (1-3 tasks). Each task object needs: "words" (array of strings to arrange), "possibleCorrectSentences" (array of strings), "explanation" (optional).
       Example: { "type": "sentenceConstruction", "instructions": "Form a sentence in Perfekt.", "tasks": [{ "words": ["ich", "gestern", "Kino", "ins", "gegangen", "bin", "."], "possibleCorrectSentences": ["Ich bin gestern ins Kino gegangen."], "explanation": "Perfekt tense structure with 'sein'." }] }

  2. OPTIONAL "interactiveVocabularyExercises": An array of 1-2 exercises.
     - If "type" is "matching":
       Provide "instructions", "pairs" (array of {german, russian}, 3-8 pairs), "germanDistractors" (optional, 1-3 strings), "russianDistractors" (optional, 1-3 strings).
       Example: { "type": "matching", "instructions": "Сопоставьте слова.", "pairs": [{"german": "Apfel", "russian": "яблоко"}, ...], "germanDistractors": ["Birne"] }
     - If "type" is "audioQuiz":
       Provide "instructions", "items" (array of 2-5 items). Each item: "germanPhraseToSpeak", "options" (3-4 Russian translations), "correctAnswer" (string), "explanation" (optional).
       Example: { "type": "audioQuiz", "instructions": "Прослушайте и выберите перевод.", "items": [{"germanPhraseToSpeak": "Wie geht es Ihnen?", "options": ["Как дела?", "Сколько это стоит?", "Где туалет?"], "correctAnswer": "Как дела?"}] }

  3. OPTIONAL "interactiveListeningExercises": An array of 1-2 exercises. These exercises should be based on the main "listeningExercise.script".
     - If "type" is "comprehensionMultipleChoice": (Based on "listeningExercise.script")
       Provide "instructions", "questions" (array of 1-3). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - If "type" is "trueFalse": (Based on "listeningExercise.script")
       Provide "instructions", "statements" (array of 2-5). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - If "type" is "sequencing": (Based on "listeningExercise.script")
       Provide "instructions", "shuffledItems" (array of 3-6 strings from the script, out of order), "correctOrder" (array of same strings in correct order).

  4. OPTIONAL "interactiveReadingExercises": An array of 1-2 exercises. These exercises should be based on the main "readingPassage".
     - If "type" is "comprehensionMultipleChoice": (Based on "readingPassage")
       Provide "instructions", "questions" (array of 1-3). Each question: "questionText", "options" (2-4 strings), "correctAnswer" (string), "explanation" (optional).
     - If "type" is "trueFalse": (Based on "readingPassage")
       Provide "instructions", "statements" (array of 2-5). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional).
     - If "type" is "sequencing": (Based on "readingPassage")
       Provide "instructions", "shuffledItems" (array of 3-6 strings/sentences from the passage, out of order), "correctOrder" (array of same strings in correct order).

  5. OPTIONAL "interactiveWritingExercises": An array of 1 exercise. This can complement or replace the general "writingPrompt".
     - If "type" is "structuredWriting":
       Provide "instructions", "promptDetails" (e.g., task description like "Write an email..."), "templateOutline" (optional, array of strings like "Anrede:", "Gruß:"), "requiredVocabulary" (optional, array of strings), "aiGeneratedStoryToDescribe" (optional, if the task is to describe a provided story).
       Example: { "type": "structuredWriting", "instructions": "Напишите email.", "promptDetails": "Пригласите друга на день рождения.", "templateOutline": ["Liebe/r [Имя],", "ich möchte dich herzlich einladen...", "Viele Grüße,"], "requiredVocabulary": ["Party", "Geschenk", "feiern"] }

  Ensure that ALL content, including all parts of interactive exercises, is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For vocabulary, always try to include example sentences and conversational phrases. For grammar, try to include exercises if suitable, focusing on core concepts like verb usage.
  The main components ("vocabulary", "grammarExplanation", "listeningExercise", "readingPassage", "readingQuestions", "writingPrompt") are mandatory. The interactive exercise arrays are optional enhancements.
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
        if (output.vocabulary.length < 5) {
            console.warn(`[generateLessonContentFlow] AI returned only ${output.vocabulary.length} vocabulary items for topic "${input.topic}" at level ${input.level}. Expected at least 5.`);
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
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1);
          console.warn(`[generateLessonContentFlow] Attempt ${retries} failed with transient error for topic "${input.topic}" at level ${input.level}. Retrying in ${delay / 1000}s... Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[generateLessonContentFlow] Failed with non-retryable error for topic "${input.topic}" at level ${input.level}:`, error);
          throw error;
        }
      }
    }
    throw new Error(`[generateLessonContentFlow] Failed after multiple retries for topic "${input.topic}" at level ${input.level}, and loop exited unexpectedly.`);
  }
);
