
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserData, LanguageLevel, TopicProgress, ModuleType, VocabularyWord, ModuleProgress, AILessonContent, AILessonVocabularyItem, AILessonListeningExercise } from '@/types/german-learning';
import { ALL_LEVELS, ALL_MODULE_TYPES, DEFAULT_TOPICS } from '@/types/german-learning';
import { generateLessonContent as generateLessonContentAI } from '@/ai/flows/generate-lesson-content';
import { evaluateUserResponse as evaluateUserResponseAI } from '@/ai/flows/evaluate-user-response';
import { recommendAiLesson as recommendAiLessonAI } from '@/ai/flows/recommend-ai-lesson';

const USER_DATA_KEY = 'sprachheld_userData';

const initialUserData: UserData = {
  currentLevel: 'A0',
  currentTopicId: undefined, // Явно добавлено для ясности
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
        if (parsedData.currentTopicId === undefined) { // Гарантируем наличие currentTopicId
            parsedData.currentTopicId = initialUserData.currentTopicId;
        }
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
    setUserData(prev => {
        if (!prev) return null;
        const newSettings = updates.settings ? { ...prev.settings, ...updates.settings, lastActivityTimestamp: Date.now() } : { ...prev.settings, lastActivityTimestamp: Date.now() };
        return { ...prev, ...updates, settings: newSettings };
    });
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
    const freshUserData = {...initialUserData, progress: defaultProgress, currentTopicId: undefined }; // Явный сброс currentTopicId
    setUserData(freshUserData);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(freshUserData));
  }, []);

  const isTopicCompleted = useCallback((level: LanguageLevel, topicId: string): boolean => {
    if (!userData?.progress?.[level]?.topics?.[topicId]) return false;
    const topic = userData.progress[level]!.topics[topicId];
    // If already marked as completed in data, return true
    if (topic.completed) return true;

    // Otherwise, check if all modules are passed
    const allModulesPassed = ALL_MODULE_TYPES.every(moduleType => {
      const moduleProgress = topic.modules[moduleType];
      return moduleProgress && moduleProgress.score !== null && moduleProgress.score >= 70;
    });
    
    // If all modules passed and topic not yet marked completed, update it
    // This function should ideally be pure.
    // The actual update of topic.completed status is now fully handled in updateModuleProgress.
    return allModulesPassed; // Return based on actual module status
  }, [userData]);


  const isLevelCompleted = useCallback((level: LanguageLevel): boolean => {
    if (!userData?.progress?.[level]) return false;
    const levelData = userData.progress[level]!;
    if (levelData.completed) return true;

    const defaultTopicIdsInLevel = DEFAULT_TOPICS[level].map(t => t.id);
    
    const customTopicsForLevel = userData.customTopics.filter(ct => ct.id.startsWith(level + "_"));
    const customTopicIdsInLevel = customTopicsForLevel.map(ct => ct.id);
    
    const allRequiredTopicIds = [...new Set([...defaultTopicIdsInLevel, ...customTopicIdsInLevel])];

    if(allRequiredTopicIds.length === 0 && DEFAULT_TOPICS[level].length > 0) {
        // This condition means default topics are defined for the level, but they are not found in allRequiredTopicIds
        // or custom topics are not being properly identified.
        // This might occur if customTopic.id structure doesn't match or default topics aren't in userData.progress yet.
        // For a robust check, ensure topics in userData.progress[level].topics are used for the check.
    }
    // More robust check: use topics present in the user's progress data for that level
    const topicsInUserData = Object.keys(userData.progress[level]?.topics || {});
    if (topicsInUserData.length === 0 && DEFAULT_TOPICS[level].length > 0) return false; // No progress on any topic yet
    if (topicsInUserData.length === 0 && customTopicsForLevel.length > 0 && defaultTopicIdsInLevel.length === 0) return false; // Only custom topics and no progress

    const allTopicsToCheck = [...new Set([...defaultTopicIdsInLevel, ...customTopicIdsInLevel])];
    if (allTopicsToCheck.length === 0) return false; // Cannot complete a level with no topics to complete

    const allTopicsDone = allTopicsToCheck.every(topicId => isTopicCompleted(level, topicId));

    if (allTopicsDone && !levelData.completed) {
         const newProgress = JSON.parse(JSON.stringify(userData.progress));
         newProgress[level]!.completed = true;

         let newCurrentLevel = userData.currentLevel;
         const currentLevelIndex = ALL_LEVELS.indexOf(level);
         if (currentLevelIndex < ALL_LEVELS.length - 1) {
            newCurrentLevel = ALL_LEVELS[currentLevelIndex + 1];
         }
        // Update state with all changes together
        setUserData(prev => prev ? ({ ...prev, progress: newProgress, currentLevel: newCurrentLevel, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } }) : null);
        return true;
    }
    return levelData.completed;
  }, [userData, isTopicCompleted, setUserData]);


  const updateModuleProgress = useCallback((level: LanguageLevel, topicId: string, moduleId: ModuleType, score: number) => {
    setUserData(prev => {
      if (!prev) return null;
      const newProgress = JSON.parse(JSON.stringify(prev.progress)); 
      
      if (!newProgress[level]) newProgress[level] = { topics: {}, completed: false };
      if (!newProgress[level].topics[topicId]) {
        const defaultTopicInfo = DEFAULT_TOPICS[level]?.find(t => t.id === topicId);
        const customTopicInfo = prev.customTopics.find(t => t.id === topicId);
        
        newProgress[level].topics[topicId] = { 
          id: topicId, 
          name: defaultTopicInfo?.name || customTopicInfo?.name || "Неизвестная тема", 
          modules: {}, 
          completed: false,
          custom: !!customTopicInfo // Mark as custom if it's in customTopics array
        };
      }
      
      const currentModuleProgress = newProgress[level].topics[topicId].modules[moduleId] || { score: null, completed: false, attempts: 0 };
      
      newProgress[level].topics[topicId].modules[moduleId] = {
        score,
        completed: score >= 70,
        lastAttemptDate: new Date().toISOString(),
        attempts: currentModuleProgress.attempts + 1,
      };

      let updatedUserData = { ...prev, progress: newProgress, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
      
      // Check for topic completion after updating module
      const topic = updatedUserData.progress[level]!.topics[topicId];
      const allModulesPassed = ALL_MODULE_TYPES.every(mType => {
        const modProg = topic.modules[mType];
        return modProg && modProg.score !== null && modProg.score >= 70;
      });

      if (allModulesPassed && !topic.completed) { // Check !topic.completed to avoid redundant writes
        updatedUserData.progress[level]!.topics[topicId].completed = true;
      }

      // Check for level completion after topic completion
      if (updatedUserData.progress[level]!.topics[topicId].completed) {
          const levelData = updatedUserData.progress[level]!;
          const defaultTopicIdsInLevel = DEFAULT_TOPICS[level].map(t => t.id);
          const customTopicIdsInLevel = updatedUserData.customTopics.filter(ct => ct.id.startsWith(level + "_")).map(ct => ct.id);
          const requiredTopicIds = [...new Set([...defaultTopicIdsInLevel, ...customTopicIdsInLevel])];
          
          if (requiredTopicIds.length > 0) { // Only check level completion if there are topics defined
            const allLevelTopicsCompleted = requiredTopicIds.every(tId => updatedUserData.progress[level]!.topics[tId]?.completed);
            
            if (allLevelTopicsCompleted && !levelData.completed) { 
              updatedUserData.progress[level]!.completed = true;
              const currentLevelIndex = ALL_LEVELS.indexOf(level);
              if (currentLevelIndex < ALL_LEVELS.length - 1) {
                  updatedUserData.currentLevel = ALL_LEVELS[currentLevelIndex + 1];
              }
            }
          }
      }
      
      return updatedUserData;
    });
  }, [setUserData]); 

  const addCustomTopic = useCallback(async (topicName: string) => {
    setUserData(prev => {
        if (!prev) return null;
        const newTopicId = `${prev.currentLevel}_custom_${Date.now()}`;
        const newTopic: TopicProgress = {
          id: newTopicId,
          name: topicName,
          modules: {},
          completed: false,
          custom: true,
        };

        const updatedCustomTopics = [...(prev.customTopics || []), newTopic];
        const updatedProgress = JSON.parse(JSON.stringify(prev.progress));
        if (!updatedProgress[prev.currentLevel]) {
            updatedProgress[prev.currentLevel] = { topics: {}, completed: false };
        }
        updatedProgress[prev.currentLevel]!.topics[newTopicId] = newTopic;
        
        return {
            ...prev,
            customTopics: updatedCustomTopics,
            progress: updatedProgress,
            currentTopicId: newTopicId, 
            settings: { ...prev.settings, lastActivityTimestamp: Date.now() }
        };
    });
  }, [setUserData]);
  
  const getTopicLessonContent = useCallback(async (level: LanguageLevel, topicName: string): Promise<AILessonContent | null> => {
    try {
      // Type assertion for lesson to match updated AILessonContent
      const lesson = await generateLessonContentAI({ level, topic: topicName }) as AILessonContent;
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
    const userProgressForAI: Record<string, number> = {};
    let weakAreas: string[] = [];

    Object.entries(userData.progress).forEach(([levelKey, levelData]) => {
      const currentLevel = levelKey as LanguageLevel;
      Object.entries(levelData.topics).forEach(([topicId, topicData]) => {
        const topicIdentifier = `${currentLevel}-${topicData.name || topicId}`;
        userProgressForAI[topicIdentifier] = 0;
        // let totalScore = 0; // Not used
        let attemptedModules = 0;
        let modulesPassed = 0;

        ALL_MODULE_TYPES.forEach(moduleKey => {
            const moduleData = topicData.modules[moduleKey];
            if (moduleData && moduleData.score !== null) {
                attemptedModules++;
                if (moduleData.score >= 70) {
                    modulesPassed++;
                } else {
                    weakAreas.push(`${moduleKey} in ${topicData.name || topicId}`);
                }
            } else if (!moduleData) {
                // Not attempted
                weakAreas.push(`${moduleKey} in ${topicData.name || topicId} (not attempted)`);
            }
        });
        if (attemptedModules > 0) {
          userProgressForAI[topicIdentifier] = (modulesPassed / ALL_MODULE_TYPES.length) * 100; // Progress as % of all modules passed
        }
        
        if(!topicData.completed && attemptedModules < ALL_MODULE_TYPES.length){
             weakAreas.push(`Topic: ${topicData.name || topicId} (incomplete)`);
        }

      });
    });
    weakAreas = [...new Set(weakAreas)]; 

    try {
      const recommendation = await recommendAiLessonAI({
        userLevel: userData.currentLevel,
        userProgress: userProgressForAI,
        weakAreas: weakAreas.slice(0, 15), 
        preferredTopics: userData.profile.preferredTopics,
      });
       if (recommendation && userData) {
         const recommendedTopicName = recommendation.topic;
         const currentLvl = userData.currentLevel;
         
         const defaultTopicsForLevel = DEFAULT_TOPICS[currentLvl] || [];
         const customTopicsForLevel = userData.customTopics.filter(ct => ct.id.startsWith(currentLvl + "_custom_"));

         let foundRecommendedTopicId: string | null = null;
         
         const defaultMatch = defaultTopicsForLevel.find(t => t.name === recommendedTopicName);
         if (defaultMatch) {
            foundRecommendedTopicId = defaultMatch.id;
         }

         if (!foundRecommendedTopicId) {
            const customMatch = customTopicsForLevel.find(t => t.name === recommendedTopicName);
            if (customMatch) {
                foundRecommendedTopicId = customMatch.id;
            }
         }

         if(foundRecommendedTopicId) {
            updateUserData({ currentTopicId: foundRecommendedTopicId });
         }
      }
      return recommendation;
    } catch (error) {
      console.error("Error getting AI recommended lesson:", error);
      return null;
    }
  }, [userData, updateUserData]);

  const addWordToBank = useCallback((wordData: Omit<VocabularyWord, 'id' | 'consecutiveCorrectAnswers' | 'errorCount'>) => {
    setUserData(prev => {
      if (!prev) return null;
      
      const existingWord = prev.vocabularyBank.find(w => 
        w.german.toLowerCase() === wordData.german.toLowerCase() && 
        w.topic === wordData.topic &&
        w.level === wordData.level
      );
      if (existingWord) return prev; 

      const newWord: VocabularyWord = {
        ...wordData,
        id: `${wordData.german.replace(/\s+/g, '-')}-${wordData.topic}-${Date.now()}`, 
        consecutiveCorrectAnswers: 0,
        errorCount: 0,
      };
      return { ...prev, vocabularyBank: [...prev.vocabularyBank, newWord], settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, [setUserData]);

  const updateWordInBank = useCallback((updatedWord: VocabularyWord) => {
    setUserData(prev => {
      if (!prev) return null;
      const wordIndex = prev.vocabularyBank.findIndex(w => w.id === updatedWord.id);
      if (wordIndex === -1) return prev; 
      
      const newBank = [...prev.vocabularyBank];
      const oldWord = prev.vocabularyBank[wordIndex];
      
      newBank[wordIndex] = {
          ...updatedWord,
          consecutiveCorrectAnswers: updatedWord.errorCount > (oldWord.errorCount || 0) ? 0 : updatedWord.consecutiveCorrectAnswers,
      };
      
      return { ...prev, vocabularyBank: newBank, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, [setUserData]);

  const getWordsForTopic = useCallback((topicId: string): VocabularyWord[] => {
    return userData?.vocabularyBank.filter(word => word.topic === topicId) || [];
  }, [userData]);

  const getWordsForReview = useCallback((): VocabularyWord[] => {
    if (!userData) return [];
    return userData.vocabularyBank.filter(word => {
        const needsReviewByErrors = word.errorCount > 0;
        const needsReviewByRepetition = word.consecutiveCorrectAnswers < 3;
        return needsReviewByErrors || needsReviewByRepetition;
    }).sort((a, b) => (a.lastTestedDate && b.lastTestedDate) ? new Date(a.lastTestedDate).getTime() - new Date(b.lastTestedDate).getTime() : (a.lastTestedDate ? -1 : 1) ); 
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


    
