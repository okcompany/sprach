import { config } from 'dotenv';
config();

import '@/ai/flows/generate-lesson-content.ts';
import '@/ai/flows/evaluate-user-response.ts';
import '@/ai/flows/recommend-ai-lesson.ts';