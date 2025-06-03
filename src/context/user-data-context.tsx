
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserData, LanguageLevel, TopicProgress, ModuleType, VocabularyWord, ModuleProgress, AILessonContent } from '@/types/german-learning';
import { ALL_LEVELS, ALL_MODULE_TYPES, DEFAULT_TOPICS } from '@/types/german-learning';
import { generateLessonContent as generateLessonContentAI } from '@/ai/flows/generate-lesson-content';
import { evaluateUserResponse as evaluateUserResponseAI } from '@/ai/flows/evaluate-user-response';
import { recommendAiLesson as recommendAiLessonAI } from '@/ai/flows/recommend-ai-lesson';

const USER_DATA_KEY = 'sprachheld_userData';

const initialUserData: UserData = {
  currentLevel: 'A0',
  profile: {},
  progress: {},
  vocabularyBank: [],
  settings: {
    notificationsEnabled: true,
    lastActivityTimestamp: Date.now(),
  },
  customTopics: [],
};

interface UserDataContextType {
  userData: UserData | null;
  isLoading: boolean;
  updateUserData: (updates: Partial<UserData>) => void;
  resetProgress: () => void;
  updateModuleProgress: (level: LanguageLevel, topicId: string, moduleId: ModuleType, score: number) => void;
  addCustomTopic: (topicName: string) => Promise<void>;
  getTopicLessonContent: (level: LanguageLevel, topicName: string) => Promise<AILessonContent | null>;
  evaluateUserResponse: (moduleType: ModuleType, userResponse: string, questionContext: string, expectedAnswer?: string, grammarRules?:string) => Promise<import('@/ai/flows/evaluate-user-response').EvaluateUserResponseOutput | null>;
  getAIRecommendedLesson: () => Promise<import('@/ai/flows/recommend-ai-lesson').RecommendAiLessonOutput | null>;
  addWordToBank: (word: Omit<VocabularyWord, 'id' | 'consecutiveCorrectAnswers' | 'errorCount'>) => void;
  updateWordInBank: (updatedWord: VocabularyWord) => void;
  getWordsForTopic: (topicId: string) => VocabularyWord[];
  getWordsForReview: () => VocabularyWord[];
  isTopicCompleted: (level: LanguageLevel, topicId: string) => boolean;
  isLevelCompleted: (level: LanguageLevel) => boolean;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider = ({ children }: { children: ReactNode }) => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(USER_DATA_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData) as UserData;
        // Ensure progress structure exists for all levels and default topics
        ALL_LEVELS.forEach(level => {
          if (!parsedData.progress[level]) {
            parsedData.progress[level] = { topics: {}, completed: false };
          }
          DEFAULT_TOPICS[level].forEach(topic => {
            if (!parsedData.progress[level]!.topics[topic.id]) {
              parsedData.progress[level]!.topics[topic.id] = {
                id: topic.id,
                name: topic.name,
                modules: {},
                completed: false,
              };
            }
          });
        });
        setUserData(parsedData);
      } else {
        // Initialize progress for all levels and default topics
        const defaultProgress: UserData['progress'] = {};
        ALL_LEVELS.forEach(level => {
          defaultProgress[level] = { topics: {}, completed: false };
          DEFAULT_TOPICS[level].forEach(topic => {
            defaultProgress[level]!.topics[topic.id] = {
              id: topic.id,
              name: topic.name,
              modules: {},
              completed: false,
            };
          });
        });
        setUserData({...initialUserData, progress: defaultProgress});
      }
    } catch (error) {
      console.error("Failed to load user data from localStorage", error);
      setUserData(initialUserData);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userData && !isLoading) {
      try {
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
      } catch (error) {
        console.error("Failed to save user data to localStorage", error);
      }
    }
  }, [userData, isLoading]);

  const updateUserData = useCallback((updates: Partial<UserData>) => {
    setUserData(prev => prev ? { ...prev, ...updates, settings: { ...prev.settings, ...updates.settings, lastActivityTimestamp: Date.now() } } : null);
  }, []);
  
  const resetProgress = useCallback(() => {
    const defaultProgress: UserData['progress'] = {};
    ALL_LEVELS.forEach(level => {
      defaultProgress[level] = { topics: {}, completed: false };
      DEFAULT_TOPICS[level].forEach(topic => {
        defaultProgress[level]!.topics[topic.id] = {
          id: topic.id,
          name: topic.name,
          modules: {},
          completed: false,
        };
      });
    });
    const freshUserData = {...initialUserData, progress: defaultProgress};
    setUserData(freshUserData);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(freshUserData));
  }, []);

  const isTopicCompleted = useCallback((level: LanguageLevel, topicId: string): boolean => {
    if (!userData?.progress?.[level]?.topics?.[topicId]) return false;
    const topic = userData.progress[level]!.topics[topicId];
    if (topic.completed) return true;

    const allModulesPassed = ALL_MODULE_TYPES.every(moduleType => {
      const moduleProgress = topic.modules[moduleType];
      return moduleProgress && moduleProgress.score !== null && moduleProgress.score >= 70;
    });
    
    if (allModulesPassed && !topic.completed) {
        updateUserData({
            progress: {
                ...userData.progress,
                [level]: {
                    ...userData.progress[level]!,
                    topics: {
                        ...userData.progress[level]!.topics,
                        [topicId]: {
                            ...topic,
                            completed: true,
                        }
                    }
                }
            }
        });
        return true;
    }
    return allModulesPassed;
  }, [userData, updateUserData]);


  const isLevelCompleted = useCallback((level: LanguageLevel): boolean => {
    if (!userData?.progress?.[level]) return false;
    const levelData = userData.progress[level]!;
    if (levelData.completed) return true;

    const allTopicsInLevel = DEFAULT_TOPICS[level].map(t => t.id);
    const customTopicsInLevel = userData.customTopics.filter(ct => ct.id.startsWith(level + "_custom_")).map(ct => ct.id); // Assuming custom topic ID format includes level

    const allRequiredTopics = [...allTopicsInLevel, ...customTopicsInLevel];
    if(allRequiredTopics.length === 0) return false; // No topics means level cannot be completed

    const allTopicsCompleted = allRequiredTopics.every(topicId => isTopicCompleted(level, topicId));

    if (allTopicsCompleted && !levelData.completed) {
         updateUserData({
            progress: {
                ...userData.progress,
                [level]: {
                    ...levelData,
                    completed: true,
                }
            }
        });
        // Potentially advance to next level
        const currentLevelIndex = ALL_LEVELS.indexOf(level);
        if (currentLevelIndex < ALL_LEVELS.length - 1) {
            const nextLevel = ALL_LEVELS[currentLevelIndex + 1];
            updateUserData({ currentLevel: nextLevel });
        }
        return true;
    }
    return allTopicsCompleted;
  }, [userData, isTopicCompleted, updateUserData]);


  const updateModuleProgress = useCallback((level: LanguageLevel, topicId: string, moduleId: ModuleType, score: number) => {
    setUserData(prev => {
      if (!prev) return null;
      const newProgress = JSON.parse(JSON.stringify(prev.progress)); // Deep copy
      
      if (!newProgress[level]) newProgress[level] = { topics: {}, completed: false };
      if (!newProgress[level].topics[topicId]) {
        const topicInfo = DEFAULT_TOPICS[level]?.find(t => t.id === topicId) || prev.customTopics.find(t => t.id === topicId);
        newProgress[level].topics[topicId] = { 
          id: topicId, 
          name: topicInfo?.name || "Пользовательская тема", 
          modules: {}, 
          completed: false,
          custom: !DEFAULT_TOPICS[level]?.find(t => t.id === topicId)
        };
      }
      
      const currentModuleProgress = newProgress[level].topics[topicId].modules[moduleId] || { score: null, completed: false, attempts: 0 };
      
      newProgress[level].topics[topicId].modules[moduleId] = {
        score,
        completed: score >= 70,
        lastAttemptDate: new Date().toISOString(),
        attempts: currentModuleProgress.attempts + 1,
      };

      const updatedUserData = { ...prev, progress: newProgress, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
      
      // Check for topic completion after updating module
      const topic = updatedUserData.progress[level]!.topics[topicId];
      const allModulesPassed = ALL_MODULE_TYPES.every(mType => {
        const modProg = topic.modules[mType];
        return modProg && modProg.score !== null && modProg.score >= 70;
      });
      if (allModulesPassed) {
        updatedUserData.progress[level]!.topics[topicId].completed = true;
      }

      // Check for level completion after topic completion
      if (updatedUserData.progress[level]!.topics[topicId].completed) {
          const levelData = updatedUserData.progress[level]!;
          const allTopicsInLevel = Object.values(DEFAULT_TOPICS[level]).map(t => t.id);
          // Consider custom topics too if they are part of this level
          const customTopicsForLevel = updatedUserData.customTopics.filter(ct => ct.id.startsWith(level + "_")).map(ct => ct.id);
          const requiredTopics = [...allTopicsInLevel, ...customTopicsForLevel];
          
          const allLevelTopicsCompleted = requiredTopics.length > 0 && requiredTopics.every(tId => updatedUserData.progress[level]!.topics[tId]?.completed);
          
          if (allLevelTopicsCompleted) {
            updatedUserData.progress[level]!.completed = true;
            const currentLevelIndex = ALL_LEVELS.indexOf(level);
            if (currentLevelIndex < ALL_LEVELS.length - 1) {
                updatedUserData.currentLevel = ALL_LEVELS[currentLevelIndex + 1];
            }
          }
      }
      
      return updatedUserData;
    });
  }, []);

  const addCustomTopic = useCallback(async (topicName: string) => {
    if (!userData) return;
    const newTopicId = `${userData.currentLevel}_custom_${Date.now()}`;
    const newTopic: TopicProgress = {
      id: newTopicId,
      name: topicName,
      modules: {},
      completed: false,
      custom: true,
    };
    // TODO: Optionally, generate initial lesson content for this custom topic via AI
    updateUserData({
      customTopics: [...(userData.customTopics || []), newTopic],
      progress: {
        ...userData.progress,
        [userData.currentLevel]: {
          ...userData.progress[userData.currentLevel]!,
          topics: {
            ...userData.progress[userData.currentLevel]!.topics,
            [newTopicId]: newTopic,
          }
        }
      }
    });
  }, [userData, updateUserData]);
  
  const getTopicLessonContent = useCallback(async (level: LanguageLevel, topicName: string): Promise<AILessonContent | null> => {
    try {
      // For simplicity, generating content on demand. Could be cached.
      const lesson = await generateLessonContentAI({ level, topic: topicName });
      return lesson;
    } catch (error) {
      console.error("Error generating lesson content:", error);
      return null;
    }
  }, []);

  const evaluateUserResponse = useCallback(async (
    moduleType: ModuleType, 
    userResponse: string, 
    questionContext: string, 
    expectedAnswer?: string, 
    grammarRules?: string
    ): Promise<import('@/ai/flows/evaluate-user-response').EvaluateUserResponseOutput | null> => {
    if(!userData) return null;
    try {
      const evaluation = await evaluateUserResponseAI({
        moduleType,
        userResponse,
        expectedAnswer,
        questionContext,
        userLevel: userData.currentLevel,
        grammarRules
      });
      return evaluation;
    } catch (error) {
      console.error("Error evaluating user response:", error);
      return null;
    }
  }, [userData]);

  const getAIRecommendedLesson = useCallback(async (): Promise<import('@/ai/flows/recommend-ai-lesson').RecommendAiLessonOutput | null> => {
    if (!userData) return null;
    // Transform progress and weak areas for AI
    const userProgressForAI: Record<string, number> = {};
    let weakAreas: string[] = [];

    Object.entries(userData.progress).forEach(([level, levelData]) => {
      Object.entries(levelData.topics).forEach(([topicId, topicData]) => {
        userProgressForAI[`${level}-${topicData.name}`] = 0;
        let totalScore = 0;
        let moduleCount = 0;
        Object.entries(topicData.modules).forEach(([moduleId, moduleData]) => {
          if (moduleData.score !== null) {
            totalScore += moduleData.score;
            moduleCount++;
            if (moduleData.score < 70) {
              weakAreas.push(`${moduleId} in ${topicData.name}`);
            }
          } else {
             weakAreas.push(`${moduleId} in ${topicData.name} (not attempted)`);
          }
        });
        if (moduleCount > 0) {
          userProgressForAI[`${level}-${topicData.name}`] = totalScore / moduleCount;
        }
      });
    });
    weakAreas = [...new Set(weakAreas)]; // Unique weak areas

    try {
      const recommendation = await recommendAiLessonAI({
        userLevel: userData.currentLevel,
        userProgress: userProgressForAI,
        weakAreas: weakAreas.slice(0, 5), // Limit weak areas sent to AI
        preferredTopics: userData.profile.preferredTopics,
      });
      return recommendation;
    } catch (error) {
      console.error("Error getting AI recommended lesson:", error);
      return null;
    }
  }, [userData]);

  const addWordToBank = useCallback((wordData: Omit<VocabularyWord, 'id' | 'consecutiveCorrectAnswers' | 'errorCount'>) => {
    setUserData(prev => {
      if (!prev) return null;
      const newWord: VocabularyWord = {
        ...wordData,
        id: `${wordData.german}-${Date.now()}`,
        consecutiveCorrectAnswers: 0,
        errorCount: 0,
      };
      return { ...prev, vocabularyBank: [...prev.vocabularyBank, newWord], settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, []);

  const updateWordInBank = useCallback((updatedWord: VocabularyWord) => {
    setUserData(prev => {
      if (!prev) return null;
      const wordIndex = prev.vocabularyBank.findIndex(w => w.id === updatedWord.id);
      if (wordIndex === -1) return prev;
      const newBank = [...prev.vocabularyBank];
      newBank[wordIndex] = updatedWord;

      // Logic for removing word if 3 consecutive correct answers
      if (updatedWord.consecutiveCorrectAnswers >= 3) {
        // newBank.splice(wordIndex, 1); // Or mark as "mastered" instead of removing
      }
      // Logic for resetting consecutiveCorrectAnswers if errorCount increases (or simply reset on error)
      // This should be handled where errorCount is incremented.

      return { ...prev, vocabularyBank: newBank, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, []);

  const getWordsForTopic = useCallback((topicId: string): VocabularyWord[] => {
    return userData?.vocabularyBank.filter(word => word.topic === topicId) || [];
  }, [userData]);

  const getWordsForReview = useCallback((): VocabularyWord[] => {
    // Example logic: words with errors or not mastered yet
    return userData?.vocabularyBank.filter(word => word.errorCount > 0 || word.consecutiveCorrectAnswers < 3) || [];
  }, [userData]);


  return (
    <UserDataContext.Provider value={{ 
        userData, 
        isLoading, 
        updateUserData, 
        resetProgress, 
        updateModuleProgress,
        addCustomTopic,
        getTopicLessonContent,
        evaluateUserResponse,
        getAIRecommendedLesson,
        addWordToBank,
        updateWordInBank,
        getWordsForTopic,
        getWordsForReview,
        isTopicCompleted,
        isLevelCompleted
      }}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};
