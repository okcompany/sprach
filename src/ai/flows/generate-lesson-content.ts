
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
  level: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('Уровень (A0-C2).'),
  topic: z.string().describe('Тема урока (например, "Путешествия").'),
});

export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// --- Zod Schemas for Vocabulary ---
const VocabularyItemSchema = z.object({
  german: z.string().describe('Немецкое слово.'),
  russian: z.string().describe('Русский перевод.'),
  exampleSentence: z.string().optional().describe('Необязательное немецкое предложение-пример.'),
});

// --- Zod Schemas for Interactive Vocabulary Exercises ---
const AIMatchingPairSchema = z.object({
  german: z.string().describe("Немецкое слово."),
  russian: z.string().describe("Соответствующее русское слово."),
});

const AIMatchingExerciseSchema = z.object({
  type: z.enum(["matching"]).describe("Тип: сопоставление."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Сопоставьте слова.'"),
  pairs: z.array(AIMatchingPairSchema).describe("Пары слов (3-6)."),
  germanDistractors: z.array(z.string()).optional().describe("Необязательные немецкие отвлекающие слова (1-2)."),
  russianDistractors: z.array(z.string()).optional().describe("Необязательные русские отвлекающие слова (1-2)."),
});

const AIAudioQuizItemSchema = z.object({
  germanPhraseToSpeak: z.string().describe("Короткая немецкая фраза для аудио."),
  options: z.array(z.string()).describe("3-4 варианта на русском."),
  correctAnswer: z.string().describe("Правильный вариант на русском."),
  explanation: z.string().optional().describe("Краткое необязательное объяснение."),
});

const AIAudioQuizExerciseSchema = z.object({
  type: z.enum(["audioQuiz"]).describe("Тип: аудио-квиз."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Прослушайте и выберите.'"),
  items: z.array(AIAudioQuizItemSchema).describe("Аудио-задания (2-4)."),
});

// --- Zod Schemas for Grammar Exercises ---
const FillInTheBlanksQuestionSchema = z.object({
  promptText: z.string().describe("Предложение на немецком с пропусками для заполнения. Опциональные подсказки для пропусков (на немецком) могут быть в скобках ()."),
  correctAnswers: z.array(z.string()).describe("Правильный ответ(ы) на немецком."),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const FillInTheBlanksExerciseSchema = z.object({
  type: z.enum(["fillInTheBlanks"]).describe("Тип: заполнение пропусков."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Заполните пропуски.'"),
  questions: z.array(FillInTheBlanksQuestionSchema).describe("Вопросы на заполнение пропусков (1-2)."),
});

const MultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Вопрос или предложение на немецком с пропуском."),
  options: z.array(z.string()).describe("2-4 варианта ответа на немецком."),
  correctAnswer: z.string().describe("Правильный вариант ответа."),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const MultipleChoiceExerciseSchema = z.object({
  type: z.enum(["multipleChoice"]).describe("Тип: множественный выбор."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Выберите правильный вариант.'"),
  questions: z.array(MultipleChoiceQuestionSchema).describe("Вопросы с множественным выбором (1-2)."),
});

const SentenceConstructionTaskSchema = z.object({
  words: z.array(z.string()).describe("Слова на немецком для составления предложения (3+)."),
  possibleCorrectSentences: z.array(z.string()).describe("Правильное(ые) предложение(я) на немецком."),
  explanation: z.string().optional().describe("Необязательное объяснение грамматического правила на русском."),
});

const SentenceConstructionExerciseSchema = z.object({
  type: z.enum(["sentenceConstruction"]).describe("Тип: составление предложений."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Составьте предложения из данных слов.'"),
  tasks: z.array(SentenceConstructionTaskSchema).describe("Задания на составление предложений (1-2)."),
});

// --- Zod Schemas for Listening ---
const ListeningExerciseSchema = z.object({
  script: z.string().describe("Скрипт для аудирования на немецком, соответствующий уровню."),
  questions: z.array(z.string()).describe("Открытые вопросы на понимание на русском или немецком (в зависимости от того, на каком языке ожидается ответ) (1-2)."),
});

// --- Zod Schemas for Interactive Listening/Reading Exercises (Common Structures) ---
const AIComprehensionMultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Вопрос на понимание (на русском или немецком)."),
  options: z.array(z.string()).describe("2-4 варианта ответа."),
  correctAnswer: z.string().describe("Правильный вариант ответа."),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const AIComprehensionMultipleChoiceExerciseSchema = z.object({
  type: z.enum(["comprehensionMultipleChoice"]).describe("Тип: MCQ на понимание."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Прочитайте/прослушайте и выберите правильный вариант.'"),
  questions: z.array(AIComprehensionMultipleChoiceQuestionSchema).describe("Вопросы (1-2)."),
});

const AITrueFalseStatementSchema = z.object({
  statement: z.string().describe("Утверждение для оценки 'верно/неверно' (на немецком или русском, в зависимости от контекста)."),
  isTrue: z.boolean().describe("Верно ли утверждение?"),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const AITrueFalseExerciseSchema = z.object({
  type: z.enum(["trueFalse"]).describe("Тип: верно/неверно."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Определите, верны ли утверждения.'"),
  statements: z.array(AITrueFalseStatementSchema).describe("Утверждения (2-4)."),
});

const AISequencingExerciseSchema = z.object({
  type: z.enum(["sequencing"]).describe("Тип: упорядочивание."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Расположите события в правильном порядке.'"),
  shuffledItems: z.array(z.string()).describe("Перемешанные элементы для упорядочивания (на немецком) (3-5)."),
  correctOrder: z.array(z.string()).describe("Элементы в правильной последовательности (на немецком)."),
});

// --- Define Zod schema for the MAIN output ---
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('Сгенерированный заголовок урока на русском или немецком.'),
  vocabulary: z.array(VocabularyItemSchema).describe('Ключевые словарные единицы. Фразы/идиомы для уровня/темы.'),
  grammarExplanation: z.string().describe('Подробное объяснение грамматики на русском. Фокус на глаголах для A0-B2.'),

  grammarFillInTheBlanks: FillInTheBlanksExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Заполните пропуски" по грамматике.'),
  grammarMultipleChoice: MultipleChoiceExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Множественный выбор" по грамматике.'),
  grammarSentenceConstruction: SentenceConstructionExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Составление предложений" по грамматике.'),

  listeningExercise: ListeningExerciseSchema.describe('Аудирование (скрипт, открытые вопросы).'),
  readingPassage: z.string().describe('Короткий текст для чтения на немецком, соответствующий уровню.'),
  readingQuestions: z.array(z.string()).describe("Открытые вопросы на понимание прочитанного (на русском или немецком)."),

  writingPrompt: z.string().describe('Общее письменное задание на русском или немецком для уровня/темы.'),

  interactiveMatchingExercise: AIMatchingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на сопоставление слов."),
  interactiveAudioQuizExercise: AIAudioQuizExerciseSchema.optional().describe("Необязательное ОДНО упражнение аудио-квиз по лексике."),

  interactiveListeningMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Необязательное ОДНО MCQ упражнение по аудированию для основного скрипта."),
  interactiveListeningTrueFalse: AITrueFalseExerciseSchema.optional().describe("Необязательное ОДНО True/False упражнение по аудированию для основного скрипта."),
  interactiveListeningSequencing: AISequencingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на упорядочивание по аудированию для основного скрипта."),

  interactiveReadingMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Необязательное ОДНО MCQ упражнение по чтению для основного текста."),
  interactiveReadingTrueFalse: AITrueFalseExerciseSchema.optional().describe("Необязательное ОДНО True/False упражнение по чтению для основного текста."),
  interactiveReadingSequencing: AISequencingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на упорядочивание по чтению для основного текста."),
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

  The ENTIRE lesson, including all instructions, explanations, prompts, and question texts, MUST be in RUSSIAN, unless it's a German word, phrase, sentence for learning, or a German text/script for reading/listening.
  Example: "lessonTitle" should be in Russian. "grammarExplanation" in Russian. "writingPrompt" in Russian. Instructions for exercises in Russian.

  The lesson MUST include the following core components:
  - "lessonTitle": A suitable title (in Russian).
  - "vocabulary": An array of at least 5 key vocabulary items (German word, Russian translation, and strongly prefer an exampleSentence in German). Include common conversational phrases and idioms relevant to the topic and level.
  - "grammarExplanation": A detailed explanation (in Russian) of a grammar point relevant to the level and topic. For levels A0-B2, systematically try to include grammar topics related to verbs (tenses, modals, reflexives, common strong/irregular verbs, word order with verbs, etc.).
  - "listeningExercise": An object with "script" and "questions".
    - "script": The script for listening must be a coherent text in the format of a **monologue or a story** from the first or third person, appropriate for the level {{{level}}}. Please **completely avoid dialogues** between characters.
    - "questions": 1-2 open-ended comprehension questions about the script (in Russian or German based on what the user is expected to answer in).
  - "readingPassage": A short reading passage in German related to the topic, appropriate for the level.
  - "readingQuestions": An array of 1-2 open-ended comprehension questions (in Russian or German) about the reading passage.
  - "writingPrompt": A general writing prompt (in Russian) for the learner.

  Additionally, you MAY provide OPTIONAL structured and interactive exercises as described below.
  For each interactive section (vocabulary, grammar, listening, reading), you may provide AT MOST ONE type of exercise if appropriate for the topic and level. These exercises should complement the core components. ALL instructions for these exercises MUST be in RUSSIAN.

  1. OPTIONAL Grammar Exercise:
     If you can create a relevant exercise for the "grammarExplanation", provide AT MOST ONE of the following fields:
     - "grammarFillInTheBlanks": Provide "instructions" (in Russian, e.g., "Заполните пропуски.") and a "questions" array (1-2 questions). Each question object needs: "promptText" (German sentence with blanks, hints in German if any), "correctAnswers" (array of German strings), "explanation" (optional, in Russian).
     - "grammarMultipleChoice": Provide "instructions" (in Russian, e.g., "Выберите правильный вариант.") and a "questions" array (1-2 questions). Each question object needs: "questionText" (German question/sentence), "options" (2-4 German strings), "correctAnswer" (German string), "explanation" (optional, in Russian).
     - "grammarSentenceConstruction": Provide "instructions" (in Russian, e.g., "Составьте предложения из слов.") and a "tasks" array (1-2 tasks). Each task object needs: "words" (array of German strings to arrange), "possibleCorrectSentences" (array of German strings), "explanation" (optional, in Russian).

  2. OPTIONAL Interactive Vocabulary Exercises: Provide AT MOST ONE of the following fields:
     - "interactiveMatchingExercise": Provide "instructions" (in Russian), "pairs" (array of {german, russian} - 3-6 pairs), "germanDistractors" (optional, 1-2 strings), "russianDistractors" (optional, 1-2 strings).
     - "interactiveAudioQuizExercise": Provide "instructions" (in Russian), "items" (array of 2-4 items). Each item: "germanPhraseToSpeak", "options" (3-4 Russian translations), "correctAnswer" (string), "explanation" (optional, in Russian).

  3. OPTIONAL Interactive Listening Exercises: Provide AT MOST ONE of the following fields. This exercise should be based on the main "listeningExercise.script". Instructions in Russian.
     - "interactiveListeningMCQ": (Based on "listeningExercise.script") Provide "instructions", "questions" (array of 1-2). Each question: "questionText" (Russian/German), "options" (strings), "correctAnswer" (string), "explanation" (optional, in Russian).
     - "interactiveListeningTrueFalse": (Based on "listeningExercise.script") Provide "instructions", "statements" (array of 2-4). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional, in Russian).
     - "interactiveListeningSequencing": (Based on "listeningExercise.script") Provide "instructions", "shuffledItems" (array of 3-5 German strings from the script, out of order), "correctOrder" (array of same strings in correct order).

  4. OPTIONAL Interactive Reading Exercises: Provide AT MOST ONE of the following fields. This exercise should be based on the main "readingPassage". Instructions in Russian.
     - "interactiveReadingMCQ": (Based on "readingPassage") Provide "instructions", "questions" (array of 1-2). Each question: "questionText" (Russian/German), "options" (strings), "correctAnswer" (string), "explanation" (optional, in Russian).
     - "interactiveReadingTrueFalse": (Based on "readingPassage") Provide "instructions", "statements" (array of 2-4). Each statement: "statement" (string), "isTrue" (boolean), "explanation" (optional, in Russian).
     - "interactiveReadingSequencing": (Based on "readingPassage") Provide "instructions", "shuffledItems" (array of 3-5 German strings/sentences from the passage, out of order), "correctOrder" (array of same strings in correct order).

  Ensure that ALL content, including all parts of interactive exercises, is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For vocabulary, always try to include example sentences and conversational phrases. For grammar, try to include an exercise if suitable, focusing on core concepts like verb usage.
  The main components ("vocabulary", "grammarExplanation", "listeningExercise", "readingPassage", "readingQuestions", "writingPrompt") are mandatory. The interactive exercise fields are optional single-object enhancements.
  Remember: All instructions, titles, explanations, and prompts for the user must be in RUSSIAN, unless it is specifically German language content for learning (e.g. vocabulary words, example sentences, reading passages, listening scripts).
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
        if (output.vocabulary && output.vocabulary.length < 1 && input.level !== 'C1' && input.level !== 'C2') { // Check if vocabulary exists before accessing length, relaxed for C1/C2
            console.warn(`[generateLessonContentFlow] AI returned only ${output.vocabulary.length} vocabulary items for topic "${input.topic}" at level ${input.level}. Expected at least 1 for A0-B2.`);
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
        const errorStatus = error.status || (error.cause as any)?.status;

        if (
          errorMessage.includes('503') ||
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('model is overloaded') ||
          errorMessage.includes('server error') ||
          errorMessage.includes('internal error') ||
          (errorStatus === 400 && errorMessage.includes('constraint that has too many states'))
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

