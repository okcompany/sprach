
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserData, LanguageLevel, TopicProgress, ModuleType, VocabularyWord, ModuleProgress, AILessonContent, AILessonVocabularyItem, AILessonListeningExercise } from '@/types/german-learning';
import { ALL_LEVELS, ALL_MODULE_TYPES, DEFAULT_TOPICS, MODULE_NAMES_RU } from '@/types/german-learning';
import { generateLessonContent as generateLessonContentAI } from '@/ai/flows/generate-lesson-content';
import { evaluateUserResponse as evaluateUserResponseAI, type EvaluateUserResponseOutput } from '@/ai/flows/evaluate-user-response';
import { recommendAiLesson as recommendAiLessonAI, type RecommendAiLessonOutput } from '@/ai/flows/recommend-ai-lesson';

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
  evaluateUserResponse: (moduleType: ModuleType, userResponse: string, questionContext: string, expectedAnswer?: string, grammarRules?:string) => Promise<EvaluateUserResponseOutput | null>;
  getAIRecommendedLesson: () => Promise<RecommendAiLessonOutput | null>;
  addWordToBank: (word: Omit<VocabularyWord, 'id' | 'consecutiveCorrectAnswers' | 'errorCount'>) => void;
  updateWordInBank: (updatedWord: VocabularyWord) => void;
  markWordAsMastered: (wordId: string) => void;
  getWordsForTopic: (topicId: string) => VocabularyWord[];
  getWordsForReview: () => VocabularyWord[];
  isTopicCompleted: (level: LanguageLevel, topicId: string) => boolean;
  isLevelCompleted: (level: LanguageLevel) => boolean;
  isLevelAccessible: (levelIdToCheck: LanguageLevel) => boolean; 
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
        if (!parsedData.profile) { 
            parsedData.profile = initialUserData.profile;
        }
        if (!parsedData.profile.preferredTopics) { 
            parsedData.profile.preferredTopics = [];
        }
        setUserData(parsedData);
      } else {
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
        if ('currentTopicId' in updates && updates.currentTopicId !== undefined) { 
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

    if (levelData.completed) return true; 

    const defaultTopicDefinitions = DEFAULT_TOPICS[level] || [];
    const customTopicDefinitions = userData?.customTopics?.filter(ct => ct.id.startsWith(level + "_")) || [];

    const allDefinedTopicIds = [
        ...defaultTopicDefinitions.map(t => t.id),
        ...customTopicDefinitions.map(t => t.id)
    ];
    
    const relevantTopicIdsInProgess = allDefinedTopicIds.filter(id => levelData.topics[id]);

    if (relevantTopicIdsInProgess.length === 0 && allDefinedTopicIds.length > 0) {
        return false; 
    }
    if (allDefinedTopicIds.length === 0) { 
        return false; 
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
  
    if (requestedLevelIndex < 0) return false; 
  
    if (requestedLevelIndex <= userCurrentLevelIndex) {
      return true;
    }
  
    if (requestedLevelIndex > 0) { 
      const previousLevel = ALL_LEVELS[requestedLevelIndex - 1];
      return isLevelCompleted(previousLevel);
    }
    
    return false; 
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
      const allModulesForTopicPassed = ALL_MODULE_TYPES.every(mType => {
        const modProg = topicData.modules[mType];
        return modProg && modProg.score !== null && modProg.score >= 70;
      });

      if (allModulesForTopicPassed && !topicData.completed) { 
        updatedUserData.progress[level]!.topics[topicId]!.completed = true;
      }

      if (updatedUserData.progress[level]!.topics[topicId]!.completed) { 
          const currentLevelData = updatedUserData.progress[level]!;
          if (!currentLevelData.completed) { 
              const defaultTopicDefs = DEFAULT_TOPICS[level] || [];
              const customTopicDefsFromUserData = updatedUserData.customTopics.filter((ct: TopicProgress) => ct.id.startsWith(level + "_"));
              
              const allDefinedTopicIdsForLevel = [
                  ...new Set([ 
                      ...defaultTopicDefs.map(t => t.id),
                      ...customTopicDefsFromUserData.map((t: TopicProgress) => t.id)
                  ])
              ];
              
              const relevantTopicIdsInProg = allDefinedTopicIdsForLevel.filter(id => currentLevelData.topics[id]);

              let allLevelTopicsTrulyCompleted = false;
              if (relevantTopicIdsInProg.length > 0 && relevantTopicIdsInProg.length === allDefinedTopicIdsForLevel.length) { 
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
                  else if (currentLevelIndex === ALL_LEVELS.length - 1) { 
                      updatedUserData.currentTopicId = undefined;
                  }
              }
          }
      }
      
      updatedUserData.settings.lastActivityTimestamp = Date.now();
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
    ): Promise<EvaluateUserResponseOutput | null> => {
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

  const getAIRecommendedLesson = useCallback(async (): Promise<RecommendAiLessonOutput | null> => {
    if (!userData) return null;
    
    const userProgressForAI: Record<string, number> = {};
    let weakAreas: string[] = [];

    const allTopicProgressEntries: Array<{ id: string; progress: number; lastActivity: number; level: LanguageLevel }> = [];

    Object.entries(userData.progress).forEach(([levelKey, levelData]) => {
      const level = levelKey as LanguageLevel;
      Object.entries(levelData.topics).forEach(([topicId, topicData]) => {
        let modulesPassed = 0;
        let maxLastAttempt = 0;
        let hasAttempts = false;

        ALL_MODULE_TYPES.forEach(moduleType => {
          const moduleProgress = topicData.modules[moduleType];
          if (moduleProgress && moduleProgress.score !== null) {
            hasAttempts = true;
            if (moduleProgress.score >= 70) {
              modulesPassed++;
            }
            if (moduleProgress.lastAttemptDate) {
              maxLastAttempt = Math.max(maxLastAttempt, new Date(moduleProgress.lastAttemptDate).getTime());
            }
          }
        });
        
        const topicCompletionPercentage = ALL_MODULE_TYPES.length > 0 ? (modulesPassed / ALL_MODULE_TYPES.length) * 100 : (topicData.completed ? 100 : 0);
        const topicIdentifier = `${level} - ${topicData.name || topicId}`;

        allTopicProgressEntries.push({
          id: topicIdentifier,
          progress: Math.round(topicCompletionPercentage),
          lastActivity: hasAttempts ? maxLastAttempt : (new Date(0).getTime()), 
          level: level,
        });
      });
    });

    allTopicProgressEntries.sort((a, b) => {
      if (a.level === userData.currentLevel && b.level !== userData.currentLevel) return -1;
      if (a.level !== userData.currentLevel && b.level === userData.currentLevel) return 1;
      return b.lastActivity - a.lastActivity; 
    });

    const MAX_PROGRESS_ENTRIES = 10;
    const selectedProgressEntries = allTopicProgressEntries.slice(0, MAX_PROGRESS_ENTRIES);

    selectedProgressEntries.forEach(entry => {
      userProgressForAI[entry.id] = entry.progress;
    });

    const MAX_WEAK_AREAS = 10; 
    const currentLevelData = userData.progress[userData.currentLevel];
    if (currentLevelData) {
      Object.values(currentLevelData.topics).filter(topic => !isTopicCompleted(userData.currentLevel, topic.id)).forEach(topicData => {
        if (weakAreas.length >= MAX_WEAK_AREAS) return;
        
        ALL_MODULE_TYPES.forEach(moduleKey => {
          if (weakAreas.length >= MAX_WEAK_AREAS) return;
          const moduleProgress = topicData.modules[moduleKey];
          const moduleName = MODULE_NAMES_RU[moduleKey];
          const topicNameStr = topicData.name || topicData.id;
          if (moduleProgress && moduleProgress.score !== null && moduleProgress.score < 70) {
            weakAreas.push(`Низкий результат (${moduleProgress.score}%) по модулю '${moduleName}' в теме '${topicNameStr}' (текущий уровень ${userData.currentLevel}).`);
          } else if (!moduleProgress) {
            weakAreas.push(`Модуль '${moduleName}' в теме '${topicNameStr}' (текущий уровень ${userData.currentLevel}) не начат.`);
          }
        });
      });
    }

    if (weakAreas.length < MAX_WEAK_AREAS) {
      Object.entries(userData.progress).forEach(([levelKey, levelData]) => {
        const loopLevel = levelKey as LanguageLevel;
        if (loopLevel === userData.currentLevel) return; 

        Object.values(levelData.topics).forEach(topicData => {
          if (weakAreas.length >= MAX_WEAK_AREAS) return;
          if (isTopicCompleted(loopLevel, topicData.id)) return; 

          ALL_MODULE_TYPES.forEach(moduleKey => {
            if (weakAreas.length >= MAX_WEAK_AREAS) return;
            const moduleProgress = topicData.modules[moduleKey];
            const moduleName = MODULE_NAMES_RU[moduleKey];
            const topicNameStr = topicData.name || topicData.id;
            if (moduleProgress && moduleProgress.score !== null && moduleProgress.score < 70) {
              weakAreas.push(`Низкий результат (${moduleProgress.score}%) по модулю '${moduleName}' в теме '${topicNameStr}' (уровень ${loopLevel}).`);
            }
          });
        });
      });
    }
    
    weakAreas = [...new Set(weakAreas)].slice(0, MAX_WEAK_AREAS);

    try {
      const recommendation = await recommendAiLessonAI({
        userLevel: userData.currentLevel,
        userProgress: userProgressForAI,
        weakAreas: weakAreas, 
        preferredTopics: userData.profile.preferredTopics || [],
      });
      return recommendation;
    } catch (error) {
      console.error("Error getting AI recommended lesson:", error);
      return null;
    }
  }, [userData, isTopicCompleted]); 

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


    