
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
import { MANDATORY_GRAMMAR_TOPICS, DEFAULT_TOPICS, type AILessonVocabularyItem as AILessonVocabularyItemType } from '@/types/german-learning';

// Define Zod schema for the input
const GenerateLessonInputSchema = z.object({
  level: z.enum(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('Уровень (A0-C2).'),
  topic: z.string().describe('Тема урока (например, "Путешествия").'), // This is the topic NAME
  topicId: z.string().describe('ID темы урока (например, "a1_travel_transport").'), // Add topicId
});

// --- Zod Schemas for Vocabulary ---
const VocabularyItemSchema = z.object({
  german: z.string().describe('Немецкое слово или фраза, СУЩЕСТВИТЕЛЬНЫЕ ДОЛЖНЫ БЫТЬ С АРТИКЛЕМ (der, die, das).'),
  russian: z.string().describe('Русский перевод.'),
  exampleSentence: z.string().optional().describe('Необязательное нем. предложение-пример.'),
});
export type AILessonVocabularyItem = z.infer<typeof VocabularyItemSchema>;

// Schema for the prompt context, including dynamically added instructions
const LessonPromptInputSchema = GenerateLessonInputSchema.extend({
  grammarFocusInstruction: z.string().describe('Instruction regarding mandatory grammar topics for the level.'),
  topicVocabularyList: z.array(VocabularyItemSchema).optional().describe('Optional list of pre-defined vocabulary for the topic.'),
});


export type GenerateLessonInput = z.infer<typeof GenerateLessonInputSchema>;

// --- Zod Schemas for Interactive Vocabulary Exercises ---
const AIMatchingPairSchema = z.object({
  german: z.string().describe("Немецкое слово. СУЩЕСТВИТЕЛЬНЫЕ ДОЛЖНЫ БЫТЬ С АРТИКЛЕМ."),
  russian: z.string().describe("Соответствующее русское слово."),
});

const AIMatchingExerciseSchema = z.object({
  type: z.enum(["matching"]).describe("Тип: сопоставление."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Сопоставьте слова.'"),
  pairs: z.array(AIMatchingPairSchema).describe("Пары слов (10-16)."),
  germanDistractors: z.array(z.string()).optional().describe("Необязательные немецкие отвлекающие слова (1-3). СУЩЕСТВИТЕЛЬНЫЕ ДОЛЖНЫ БЫТЬ С АРТИКЛЕМ."),
  russianDistractors: z.array(z.string()).optional().describe("Необязательные русские отвлекающие слова (1-3)."),
});

const AIAudioQuizItemSchema = z.object({
  germanPhraseToSpeak: z.string().describe("Короткая немецкая фраза для аудио. СУЩЕСТВИТЕЛЬНЫЕ ДОЛЖНЫ БЫТЬ С АРТИКЛЕМ."),
  options: z.array(z.string()).describe("3-4 варианта на русском."),
  correctAnswer: z.string().describe("Правильный вариант на русском."),
  explanation: z.string().optional().describe("Краткое необязательное объяснение."),
});

const AIAudioQuizExerciseSchema = z.object({
  type: z.enum(["audioQuiz"]).describe("Тип: аудио-квиз."),
  instructions: z.string().describe("Инструкции для упражнения, например, 'Прослушайте и выберите.'"),
  items: z.array(AIAudioQuizItemSchema).describe("Аудио-задания (6-10)."),
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
  questions: z.array(FillInTheBlanksQuestionSchema).describe("Вопросы на заполнение пропусков (4-8)."),
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
  questions: z.array(MultipleChoiceQuestionSchema).describe("Вопросы с множественным выбором (4-8)."),
});

const SentenceConstructionTaskSchema = z.object({
  words: z.array(z.string()).describe("Слова на немецком для составления предложения (3+)."),
  possibleCorrectSentences: z.array(z.string()).describe("Правильное(ые) предложение(я) на немецком."),
  explanation: z.string().optional().describe("Необязательное объяснение грамматического правила на русском."),
});

const SentenceConstructionExerciseSchema = z.object({
  type: z.enum(["sentenceConstruction"]).describe("Тип: составление предложений."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Составьте предложения из данных слов.'"),
  tasks: z.array(SentenceConstructionTaskSchema).describe("Задания на составление предложений (4-6)."),
});

// --- Zod Schemas for Listening ---
const ListeningExerciseSchema = z.object({
  script: z.string().describe("Скрипт для аудирования на немецком, соответствующий уровню."),
  questions: z.array(z.string()).describe("Открытые вопросы на понимание на русском (4-8)."),
});

// --- Zod Schemas for Interactive Listening/Reading Exercises (Common Structures) ---
const AIComprehensionMultipleChoiceQuestionSchema = z.object({
  questionText: z.string().describe("Вопрос на понимание (на русском)."),
  options: z.array(z.string()).describe("2-4 варианта ответа."),
  correctAnswer: z.string().describe("Правильный вариант ответа."),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const AIComprehensionMultipleChoiceExerciseSchema = z.object({
  type: z.enum(["comprehensionMultipleChoice"]).describe("Тип: MCQ на понимание."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Прочитайте/прослушайте и выберите правильный вариант.'"),
  questions: z.array(AIComprehensionMultipleChoiceQuestionSchema).describe("Вопросы (4-6)."),
});

const AITrueFalseStatementSchema = z.object({
  statement: z.string().describe("Утверждение для оценки 'верно/неверно' (на русском)."),
  isTrue: z.boolean().describe("Верно ли утверждение?"),
  explanation: z.string().optional().describe("Необязательное объяснение на русском."),
});

const AITrueFalseExerciseSchema = z.object({
  type: z.enum(["trueFalse"]).describe("Тип: верно/неверно."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Определите, верны ли утверждения.'"),
  statements: z.array(AITrueFalseStatementSchema).describe("Утверждения (6-10)."),
});

const AISequencingExerciseSchema = z.object({
  type: z.enum(["sequencing"]).describe("Тип: упорядочивание."),
  instructions: z.string().describe("Инструкции для упражнения на русском, например, 'Расположите события в правильном порядке.'"),
  shuffledItems: z.array(z.string()).describe("Перемешанные элементы для упорядочивания (на немецком) (8-12)."),
  correctOrder: z.array(z.string()).describe("Элементы в правильной последовательности (на немецком) (8-12)."),
});

// --- Define Zod schema for the MAIN output ---
const GenerateLessonOutputSchema = z.object({
  lessonTitle: z.string().describe('Сгенерированный заголовок урока на русском или немецком.'),
  vocabulary: z.array(VocabularyItemSchema).describe('Ключевые словарные единицы (14-20). Фразы/идиомы для уровня/темы. Каждый элемент должен содержать немецкое слово (СУЩЕСТВИТЕЛЬНЫЕ С АРТИКЛЕМ), русский перевод и пример предложения на немецком.'),
  grammarExplanation: z.string().describe('Подробное объяснение грамматики на русском. Фокус на глаголах для A0-B2.'),

  grammarFillInTheBlanks: FillInTheBlanksExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Заполните пропуски" по грамматике (4-8 вопроса).'),
  grammarMultipleChoice: MultipleChoiceExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Множественный выбор" по грамматике (4-8 вопроса).'),
  grammarSentenceConstruction: SentenceConstructionExerciseSchema.optional().describe('Необязательное ОДНО упражнение "Составление предложений" по грамматике (4-6 задания).'),

  listeningExercise: ListeningExerciseSchema.describe('Аудирование (скрипт, 4-8 открытых вопроса на русском).'),
  readingPassage: z.string().describe('Короткий текст для чтения на немецком, соответствующий уровню.'),
  readingQuestions: z.array(z.string()).describe("Открытые вопросы на понимание прочитанного (на русском) (4-8)."),

  writingPrompt: z.string().describe('Общее письменное задание на русском или немецком для уровня/темы. Укажите язык ответа.'),

  interactiveMatchingExercise: AIMatchingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на сопоставление слов (10-16 пар)."),
  interactiveAudioQuizExercise: AIAudioQuizExerciseSchema.optional().describe("Необязательное ОДНО упражнение аудио-квиз по лексике (6-10 заданий)."),

  interactiveListeningMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Необязательное ОДНО MCQ упражнение по аудированию для основного скрипта (4-6 вопроса на русском)."),
  interactiveListeningTrueFalse: AITrueFalseExerciseSchema.optional().describe("Необязательное ОДНО True/False упражнение по аудированию для основного скрипта (6-10 утверждений на русском)."),
  interactiveListeningSequencing: AISequencingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на упорядочивание по аудированию для основного скрипта (8-12 элементов)."),

  interactiveReadingMCQ: AIComprehensionMultipleChoiceExerciseSchema.optional().describe("Необязательное ОДНО MCQ упражнение по чтению для основного текста (4-6 вопроса на русском)."),
  interactiveReadingTrueFalse: AITrueFalseExerciseSchema.optional().describe("Необязательное ОДНО True/False упражнение по чтению для основного текста (6-10 утверждений на русском)."),
  interactiveReadingSequencing: AISequencingExerciseSchema.optional().describe("Необязательное ОДНО упражнение на упорядочивание по чтению для основного текста (8-12 элементов)."),
});

export type GenerateLessonOutput = z.infer<typeof GenerateLessonOutputSchema>;

export async function generateLessonContent(input: GenerateLessonInput): Promise<GenerateLessonOutput> {
  const grammarTopicsForLevel = MANDATORY_GRAMMAR_TOPICS[input.level] || [];
  const grammarFocusInstruction = grammarTopicsForLevel.length > 0
      ? `Для объяснения грамматики ("grammarExplanation") выберите ОДНУ грамматическую тему, релевантную уровню ${input.level} и лексической теме "${input.topic}". Пожалуйста, постарайтесь выбрать тему из следующего списка обязательных грамматических тем для уровня ${input.level}: ${grammarTopicsForLevel.join("; ")}. Если ни одна из них не подходит идеально, выберите наиболее близкую и релевантную тему, подходящую для данного уровня. Объяснение должно быть подробным и на русском языке.`
      : "Для объяснения грамматики (\"grammarExplanation\") выберите подходящую грамматическую тему для этого уровня и лексической темы, и объясните её подробно на русском языке.";

  const topicVocabularyList = DEFAULT_TOPICS[input.level]?.find(t => t.id === input.topicId)?.fallbackVocabulary || [];
  
  const promptPayload: z.infer<typeof LessonPromptInputSchema> = {
    level: input.level,
    topic: input.topic, // Topic name
    topicId: input.topicId, // Topic ID
    grammarFocusInstruction: grammarFocusInstruction,
    topicVocabularyList: topicVocabularyList as AILessonVocabularyItemType[],
  };
  
  return generateLessonContentFlow(promptPayload);
}

// Define the prompt
const lessonPrompt = ai.definePrompt({
  name: 'lessonPrompt',
  input: {schema: LessonPromptInputSchema},
  output: {schema: GenerateLessonOutputSchema},
  prompt: `You are an expert German language teacher. Generate a comprehensive German lesson for a student.
  The student is at level: {{{level}}}
  The topic is: {{{topic}}} (ID: {{{topicId}}})

  **CRITICAL RULE: ALL GERMAN NOUNS (Substantive) in the entire output MUST be preceded by their definite article (der, die, das). This applies to "vocabulary", all exercise types ("german" fields in pairs, distractors, phrases to speak, etc.), and within any German text you generate. For example, instead of "Haus", write "das Haus". Instead of "Katze", write "die Katze".**

  The ENTIRE lesson, including all instructions, explanations, prompts, and question texts, MUST be in RUSSIAN, unless it's a German word, phrase, sentence for learning, or a German text/script for reading/listening.
  Example: "lessonTitle" should be in Russian. "grammarExplanation" in Russian. "writingPrompt" in Russian. Instructions for exercises in Russian.
  For all questions and tasks, clearly indicate the language in which the user is expected to respond (e.g., 'Ответьте на немецком', 'Ответьте на русском'), unless it's absolutely obvious from the task itself (like translating a single word).

  The lesson MUST include the following core components:
  - "lessonTitle": A suitable title (in Russian).
  - "vocabulary": 
    {{#if topicVocabularyList.length}}
    For the vocabulary section, you MUST primarily use the words from the 'topicVocabularyList' provided below. Ensure each item has a German word (with article for nouns), a Russian translation, and a good German example sentence (generate one if missing or improve the existing one). The target is 14-20 vocabulary items. If the provided list has fewer than 14 items, you may supplement it with 2-5 highly relevant additional words for the topic '{{{topic}}}' and level '{{{level}}}', ensuring they also have German (with article), Russian, and an example sentence. The items you generate MUST conform to the AILessonVocabularyItem schema.
    Provided 'topicVocabularyList' (use these first):
    {{#each topicVocabularyList}}
    - German: {{this.german}}, Russian: {{this.russian}}{{#if this.exampleSentence}}, Current Example: {{this.exampleSentence}}{{/if}}
    {{/each}}
    {{else}}
    An array of 14-20 key vocabulary items (German word with article for nouns, Russian translation, and strongly prefer an exampleSentence in German). Include common conversational phrases and idioms relevant to the topic and level. These items MUST conform to the AILessonVocabularyItem schema.
    {{/if}}
  - "grammarExplanation": {{{grammarFocusInstruction}}} When explaining the chosen grammar topic, ensure your detailed explanation (which MUST be in RUSSIAN) clearly covers its relevant **morphological aspects** (e.g., word formation, declensions, conjugations, endings, strong/weak patterns, participle formation, comparison degrees for adjectives as relevant to the topic and level) and **syntactic aspects** (e.g., sentence structure, word order in main and subordinate clauses [V2, verb-final], types of sentences [declarative, interrogative, imperative], use of conjunctions and their impact on sentence structure, formation of complex sentences, passive voice construction, infinitive clauses, as relevant to the explained grammar topic and user level). For levels A0-B2, systematically try to include grammar topics related to verbs (tenses, modals, reflexives, common strong/irregular verbs, word order with verbs, etc.), while respecting the mandatory list provided in grammarFocusInstruction.
  - "listeningExercise": An object with "script" and "questions".
    - "script": The script for listening must be a coherent text in the format of a **monologue or a story** from the first or third person, appropriate for the level {{{level}}}. Please **completely avoid dialogues** between characters.
    - "questions": An array of 4-8 open-ended comprehension questions about the script. These questions MUST ALWAYS be in RUSSIAN. For each question, explicitly state if the answer should be in Russian or German.
  - "readingPassage": A short reading passage in German related to the topic, appropriate for the level.
  - "readingQuestions": An array of 4-8 open-ended comprehension questions about the reading passage. These questions MUST ALWAYS be in RUSSIAN. For each question, explicitly state if the answer should be in Russian or German.
  - "writingPrompt": A general writing prompt (in Russian) for the learner. Clearly specify the language in which the user should write.

  Additionally, you MAY provide OPTIONAL structured and interactive exercises as described below.
  For each interactive section (vocabulary, grammar, listening, reading), you may provide AT MOST ONE type of exercise if appropriate for the topic and level. These exercises should complement the core components. ALL instructions for these exercises MUST be in RUSSIAN. Ensure answers for grammar exercises are expected in German unless specified otherwise.

  1. OPTIONAL Grammar Exercise:
     If you can create a relevant exercise for the "grammarExplanation", provide AT MOST ONE of the following fields:
     - "grammarFillInTheBlanks": Provide "instructions" (in Russian, e.g., "Заполните пропуски.") and a "questions" array (4-8 questions). Each question object needs: "promptText" (German sentence with blanks, optional hints for blanks (in German) can be in ()), "correctAnswers" (array of German strings), "explanation" (optional, in Russian).
     - "grammarMultipleChoice": Provide "instructions" (in Russian, e.g., "Выберите правильный вариант.") and a "questions" array (4-8 questions). Each question object needs: "questionText" (German question/sentence), "options" (2-4 German strings), "correctAnswer" (German string), "explanation" (optional, in Russian).
     - "grammarSentenceConstruction": Provide "instructions" (in Russian, e.g., "Составьте предложения из слов.") and a "tasks" array (4-6 tasks). Each task object needs: "words" (array of German strings to arrange), "possibleCorrectSentences" (array of German strings), "explanation" (optional, in Russian).

  2. OPTIONAL Interactive Vocabulary Exercises: Provide AT MOST ONE of the following fields:
     - "interactiveMatchingExercise": Provide "instructions" (in Russian), "pairs" (array of {german, russian} - 10-16 pairs from the main "vocabulary" list), "germanDistractors" (optional, 1-3 strings), "russianDistractors" (optional, 1-3 strings).
     - "interactiveAudioQuizExercise": Provide "instructions" (in Russian), "items" (array of 6-10 items from the main "vocabulary" list). Each item: "germanPhraseToSpeak", "options" (3-4 Russian translations), "correctAnswer" (string), "explanation" (optional, in Russian).

  3. OPTIONAL Interactive Listening Exercises: Provide AT MOST ONE of the following fields. This exercise should be based on the main "listeningExercise.script". Instructions and questions/statements MUST be in RUSSIAN. For each question/statement, ensure the expected answer language is clear from the context or explicitly stated.
     - "interactiveListeningMCQ": (Based on "listeningExercise.script") Provide "instructions", "questions" (array of 4-6). Each question: "questionText" (Russian), "options" (strings), "correctAnswer" (string), "explanation" (optional, in Russian).
     - "interactiveListeningTrueFalse": (Based on "listeningExercise.script") Provide "instructions", "statements" (array of 6-10). Each statement: "statement" (Russian), "isTrue" (boolean), "explanation" (optional, in Russian).
     - "interactiveListeningSequencing": (Based on "listeningExercise.script") Provide "instructions", "shuffledItems" (array of 8-12 German strings from the script, out of order), "correctOrder" (array of same strings in correct order).

  4. OPTIONAL Interactive Reading Exercises: Provide AT MOST ONE of the following fields. This exercise should be based on the main "readingPassage". Instructions and questions/statements MUST be in RUSSIAN. For each question/statement, ensure the expected answer language is clear from the context or explicitly stated.
     - "interactiveReadingMCQ": (Based on "readingPassage") Provide "instructions", "questions" (array of 4-6). Each question: "questionText" (Russian), "options" (strings), "correctAnswer" (string), "explanation" (optional, in Russian).
     - "interactiveReadingTrueFalse": (Based on "readingPassage") Provide "instructions", "statements" (array of 6-10). Each statement: "statement" (Russian), "isTrue" (boolean), "explanation" (optional, in Russian).
     - "interactiveReadingSequencing": (Based on "readingPassage") Provide "instructions", "shuffledItems" (array of 8-12 German strings/sentences from the passage, out of order), "correctOrder" (array of same strings in correct order).

  Ensure that ALL content, including all parts of interactive exercises, is appropriate for the specified level: {{{level}}}.
  Provide rich and varied content. For grammar, try to include an exercise if suitable, focusing on core concepts like verb usage.
  The main components ("vocabulary", "grammarExplanation", "listeningExercise", "readingPassage", "readingQuestions", "writingPrompt") are mandatory. The interactive exercise fields are optional single-object enhancements.
  Remember: All instructions, titles, explanations, and prompts for the user must be in RUSSIAN, unless it is specifically German language content for learning (e.g. vocabulary words, example sentences, reading passages, listening scripts).
  Output must be a valid JSON object matching the GenerateLessonOutputSchema. Ensure vocabulary items always include 'german', 'russian', and 'exampleSentence' fields.
`,
});

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 3000;

// Define the flow
const generateLessonContentFlow = ai.defineFlow(
  {
    name: 'generateLessonContentFlow',
    inputSchema: LessonPromptInputSchema,
    outputSchema: GenerateLessonOutputSchema,
  },
  async (inputWithInstructions: z.infer<typeof LessonPromptInputSchema>) => {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const {output} = await lessonPrompt(inputWithInstructions);
        if (!output) {
          throw new Error('[generateLessonContentFlow] AI model returned an empty output during lesson generation.');
        }
        if (output.vocabulary && output.vocabulary.length < 1 && inputWithInstructions.level !== 'C1' && inputWithInstructions.level !== 'C2' && (!inputWithInstructions.topicVocabularyList || inputWithInstructions.topicVocabularyList.length === 0) ) {
            console.warn(`[generateLessonContentFlow] AI returned only ${output.vocabulary.length} vocabulary items for topic "${inputWithInstructions.topic}" at level ${inputWithInstructions.level} when no predefined list was used. Expected more for A0-B2.`);
        }
        // Ensure all vocabulary items have example sentences
        if (output.vocabulary) {
          output.vocabulary.forEach(item => {
            if (!item.exampleSentence) {
              // This is a fallback, ideally the AI generates it.
              // Forcing a generic example if AI fails is not ideal, but schema demands it.
              // Better approach: If AI fails this, we could log an error or retry, but for now let's just warn.
              console.warn(`[generateLessonContentFlow] Vocabulary item "${item.german}" is missing exampleSentence for topic "${inputWithInstructions.topic}" at level ${inputWithInstructions.level}. The AI should have generated this.`);
              item.exampleSentence = `Пример для ${item.german} будет добавлен позже.`; // Placeholder to satisfy schema
            }
          });
        }
        return output;
      } catch (error: any) {
        retries++;
        console.error(`[generateLessonContentFlow] Attempt ${retries} for topic "${inputWithInstructions.topic}" (ID: ${inputWithInstructions.topicId}) level ${inputWithInstructions.level} FAILED. Error:`, error.message ? error.message : error);
        if (retries >= MAX_RETRIES) {
          console.error(`[generateLessonContentFlow] All ${MAX_RETRIES} retries FAILED for input:`, JSON.stringify(inputWithInstructions, null, 2), "Last error:", error.message ? error.message : error);
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
          console.warn(`[generateLessonContentFlow] Attempt ${retries} failed for topic "${inputWithInstructions.topic}" at level ${inputWithInstructions.level} (Error: ${error.message ? error.message.split('\n')[0] : 'Unknown'}). Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[generateLessonContentFlow] Failed with non-retryable error for topic "${inputWithInstructions.topic}" at level ${inputWithInstructions.level}. Input:`, JSON.stringify(inputWithInstructions, null, 2), "Error:", error.message ? error.message : error);
          throw error;
        }
      }
    }
    throw new Error(`[generateLessonContentFlow] Failed after multiple retries for topic "${inputWithInstructions.topic}" at level ${inputWithInstructions.level}, and loop exited unexpectedly.`);
  }
);


    
