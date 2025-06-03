
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
  currentTopicId: undefined, 
  profile: {
    preferredTopics: [],
  },
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
  markWordAsMastered: (wordId: string) => void;
  getWordsForTopic: (topicId: string) => VocabularyWord[];
  getWordsForReview: () => VocabularyWord[];
  isTopicCompleted: (level: LanguageLevel, topicId: string) => boolean;
  isLevelCompleted: (level: LanguageLevel) => boolean;
  isLevelAccessible: (levelIdToCheck: LanguageLevel) => boolean; // Added
  getCurrentLevelProgress: () => number;
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
        if (parsedData.currentTopicId === undefined) { 
            parsedData.currentTopicId = initialUserData.currentTopicId;
        }
        if (!parsedData.profile) { // Ensure profile exists
            parsedData.profile = initialUserData.profile;
        }
        if (!parsedData.profile.preferredTopics) { // Ensure preferredTopics exists
            parsedData.profile.preferredTopics = [];
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
        const newProfile = updates.profile ? { ...prev.profile, ...updates.profile } : prev.profile;
        
        let newCurrentTopicId = prev.currentTopicId;
        if ('currentTopicId' in updates && updates.currentTopicId !== undefined) { // Check for undefined explicitly
          newCurrentTopicId = updates.currentTopicId;
        } else if ('currentTopicId' in updates && updates.currentTopicId === undefined) {
          newCurrentTopicId = undefined;
        }
        
        return { ...prev, ...updates, settings: newSettings, profile: newProfile, currentTopicId: newCurrentTopicId };
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
    const freshUserData = {...initialUserData, progress: defaultProgress, currentTopicId: undefined }; 
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
    
    return allModulesPassed; 
  }, [userData]);


  const isLevelCompleted = useCallback((level: LanguageLevel): boolean => {
    const levelData = userData?.progress?.[level];
    if (!levelData) return false;

    if (levelData.completed) return true; // Already marked as completed

    const defaultTopicDefinitions = DEFAULT_TOPICS[level] || [];
    const customTopicDefinitions = userData?.customTopics?.filter(ct => ct.id.startsWith(level + "_")) || [];

    const allDefinedTopicIds = [
        ...defaultTopicDefinitions.map(t => t.id),
        ...customTopicDefinitions.map(t => t.id)
    ];
    
    const relevantTopicIdsInProgess = allDefinedTopicIds.filter(id => levelData.topics[id]);

    if (relevantTopicIdsInProgess.length === 0 && allDefinedTopicIds.length > 0) {
        return false; // Topics are defined for the level, but none are in progress (or tracked), so not completed.
    }
    if (allDefinedTopicIds.length === 0) { // No topics defined for this level (e.g. future C2 content)
        return false; // Cannot be completed if no topics are defined (unless explicitly set by other means)
    }
    
    const allTrackedTopicsCompleted = relevantTopicIdsInProgess.every(topicId => 
      isTopicCompleted(level, topicId) 
    );

    return allTrackedTopicsCompleted;
  }, [userData, isTopicCompleted]);

  const isLevelAccessible = useCallback((levelIdToCheck: LanguageLevel): boolean => {
    if (!userData) return false;
  
    const requestedLevelIndex = ALL_LEVELS.indexOf(levelIdToCheck);
    const userCurrentLevelIndex = ALL_LEVELS.indexOf(userData.currentLevel);
  
    if (requestedLevelIndex < 0) return false; // levelIdToCheck is not a valid level
  
    // Levels already passed or the current level are accessible
    if (requestedLevelIndex <= userCurrentLevelIndex) {
      return true;
    }
  
    // For future levels, check if all preceding levels are completed
    // This means checking if the level *just before* the requestedLevelIndex is completed.
    if (requestedLevelIndex > 0) { // Ensure there is a previous level
      const previousLevel = ALL_LEVELS[requestedLevelIndex - 1];
      return isLevelCompleted(previousLevel);
    }
    
    return false; // Should not be reached if ALL_LEVELS[0] is 'A0' and currentLevel is 'A0'
  }, [userData, isLevelCompleted]);

  const getCurrentLevelProgress = useCallback((): number => {
    if (!userData || !userData.currentLevel) return 0;
    const level = userData.currentLevel;
    const levelData = userData.progress[level];
    if (!levelData) return 0;

    const defaultTopicObjects = DEFAULT_TOPICS[level] || [];
    const customTopicObjectsForLevel = userData.customTopics.filter(
      (ct) => ct.id.startsWith(level + "_custom_")
    );

    const allTopicDefinitionsForLevel = [
        ...defaultTopicObjects,
        ...customTopicObjectsForLevel.map(ct => ({id: ct.id, name: ct.name})) 
    ];
    
    const allUniqueTopicIdsForLevel = [...new Set(allTopicDefinitionsForLevel.map(t => t.id))];


    if (allUniqueTopicIdsForLevel.length === 0) {
      return levelData.completed ? 100 : 0;
    }

    let completedTopicsCount = 0;
    allUniqueTopicIdsForLevel.forEach(topicId => {
      if (levelData.topics[topicId] && isTopicCompleted(level, topicId)) {
        completedTopicsCount++;
      }
    });
    
    const progress = (completedTopicsCount / allUniqueTopicIdsForLevel.length) * 100;
    return Math.round(progress);
  }, [userData, isTopicCompleted]);


  const updateModuleProgress = useCallback((level: LanguageLevel, topicId: string, moduleId: ModuleType, score: number) => {
    setUserData(prev => {
      if (!prev) return null;
      const updatedUserData = JSON.parse(JSON.stringify(prev)) as UserData; 
      
      if (!updatedUserData.progress[level]) updatedUserData.progress[level] = { topics: {}, completed: false };
      if (!updatedUserData.progress[level]!.topics[topicId]) {
        const defaultTopicInfo = DEFAULT_TOPICS[level]?.find(t => t.id === topicId);
        const customTopicInfo = updatedUserData.customTopics.find((t: TopicProgress) => t.id === topicId);
        
        updatedUserData.progress[level]!.topics[topicId] = { 
          id: topicId, 
          name: defaultTopicInfo?.name || customTopicInfo?.name || "Неизвестная тема", 
          modules: {}, 
          completed: false,
          custom: !!customTopicInfo 
        };
      }
      
      const currentModuleProgress = updatedUserData.progress[level]!.topics[topicId]!.modules[moduleId] || { score: null, completed: false, attempts: 0 };
      
      updatedUserData.progress[level]!.topics[topicId]!.modules[moduleId] = {
        score,
        completed: score >= 70,
        lastAttemptDate: new Date().toISOString(),
        attempts: currentModuleProgress.attempts + 1,
      };
      
      const topicData = updatedUserData.progress[level]!.topics[topicId]!;
      // Check if this topic is now completed
      const allModulesForTopicPassed = ALL_MODULE_TYPES.every(mType => {
        const modProg = topicData.modules[mType];
        return modProg && modProg.score !== null && modProg.score >= 70;
      });

      if (allModulesForTopicPassed && !topicData.completed) { 
        updatedUserData.progress[level]!.topics[topicId]!.completed = true;
      }

      // Check if this level is now completed
      if (updatedUserData.progress[level]!.topics[topicId]!.completed) { // if current topic got completed
          const currentLevelData = updatedUserData.progress[level]!;
          if (!currentLevelData.completed) { // And level itself is not yet marked as completed
              const defaultTopicDefs = DEFAULT_TOPICS[level] || [];
              const customTopicDefsFromUserData = updatedUserData.customTopics.filter((ct: TopicProgress) => ct.id.startsWith(level + "_"));
              
              const allDefinedTopicIdsForLevel = [
                  ...new Set([ // Ensure uniqueness if a custom topic somehow has same ID as default
                      ...defaultTopicDefs.map(t => t.id),
                      ...customTopicDefsFromUserData.map((t: TopicProgress) => t.id)
                  ])
              ];
              
              const relevantTopicIdsInProg = allDefinedTopicIdsForLevel.filter(id => currentLevelData.topics[id]);

              let allLevelTopicsTrulyCompleted = false;
              if (relevantTopicIdsInProg.length > 0 && relevantTopicIdsInProg.length === allDefinedTopicIdsForLevel.length) { // ensure all defined topics are tracked
                  allLevelTopicsTrulyCompleted = relevantTopicIdsInProg.every(
                      tId => updatedUserData.progress[level]!.topics[tId]?.completed === true
                  );
              }
              
              if (allLevelTopicsTrulyCompleted) { 
                  updatedUserData.progress[level]!.completed = true;
                  const currentLevelIndex = ALL_LEVELS.indexOf(level);
                  if (currentLevelIndex < ALL_LEVELS.length - 1) {
                      updatedUserData.currentLevel = ALL_LEVELS[currentLevelIndex + 1];
                      updatedUserData.currentTopicId = undefined; 
                  }
                  else if (currentLevelIndex === ALL_LEVELS.length - 1) { // Max level completed
                      updatedUserData.currentTopicId = undefined;
                  }
              }
          }
      }
      
      updatedUserData.settings.lastActivityTimestamp = Date.now();
      return updatedUserData;
    });
  }, [setUserData]); // Added isLevelCompleted and ALL_LEVELS to dependencies if they were used directly

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
                weakAreas.push(`${moduleKey} in ${topicData.name || topicId} (not attempted)`);
            }
        });
        if (ALL_MODULE_TYPES.length > 0) { 
          userProgressForAI[topicIdentifier] = (modulesPassed / ALL_MODULE_TYPES.length) * 100; 
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
        preferredTopics: userData.profile.preferredTopics || [],
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
      newBank[wordIndex] = updatedWord;
      
      return { ...prev, vocabularyBank: newBank, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, [setUserData]);

  const markWordAsMastered = useCallback((wordId: string) => {
    setUserData(prev => {
        if (!prev) return null;
        const wordIndex = prev.vocabularyBank.findIndex(w => w.id === wordId);
        if (wordIndex === -1) return prev;

        const newBank = [...prev.vocabularyBank];
        const masteredWord = {
            ...newBank[wordIndex],
            consecutiveCorrectAnswers: 3, 
            errorCount: 0, 
            lastTestedDate: new Date().toISOString(),
        };
        newBank[wordIndex] = masteredWord;
        return { ...prev, vocabularyBank: newBank, settings: { ...prev.settings, lastActivityTimestamp: Date.now() } };
    });
  }, [setUserData]);

  const getWordsForTopic = useCallback((topicId: string): VocabularyWord[] => {
    return userData?.vocabularyBank.filter(word => word.topic === topicId) || [];
  }, [userData]);

  const getWordsForReview = useCallback((): VocabularyWord[] => {
    if (!userData) return [];
    return userData.vocabularyBank.filter(word => {
        const needsReviewByErrors = (word.errorCount || 0) > 0; 
        const needsReviewByRepetition = (word.consecutiveCorrectAnswers || 0) < 3; 
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
        markWordAsMastered,
        getWordsForTopic,
        getWordsForReview,
        isTopicCompleted,
        isLevelCompleted,
        isLevelAccessible,
        getCurrentLevelProgress
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

