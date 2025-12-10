
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DashboardPage } from './dashboard-page';
import { useUserData } from '@/context/user-data-context';

// Mock the user data context
jest.mock('@/context/user-data-context');

// Mock the constants module to control DEFAULT_TOPICS
jest.mock('@/types/german-learning', () => ({
  ...jest.requireActual('@/types/german-learning'),
  DEFAULT_TOPICS: {
    A1: [{ id: 'A1_Topic_1', name: 'Alphabet' }],
  },
}));

const mockUseUserData = useUserData as jest.Mock;

describe('DashboardPage', () => {
  it('falls back to the next step card when AI recommendation fails', async () => {
    mockUseUserData.mockReturnValue({
      userData: {
        currentLevel: 'A1',
        progress: {
          A1: {
            topics: {
              'A1_Topic_1': { name: 'Alphabet', completed: false },
            },
          },
        },
        customTopics: [],
      },
      isLoading: false,
      getAIRecommendedLesson: jest.fn().mockResolvedValue(null),
      isLevelCompleted: jest.fn().mockReturnValue(false),
      isTopicCompleted: jest.fn().mockReturnValue(false),
      updateUserData: jest.fn(),
    });

    render(<DashboardPage />);

    const getRecommendationButton = screen.getByRole('button', { name: /Получить/i });

    // Use act to wrap the state update
    await act(async () => {
      fireEvent.click(getRecommendationButton);
    });

    // Check that the next step card is displayed
    expect(screen.getByText(/Следующий урок/i)).toBeInTheDocument();
    expect(screen.getByText(/Продолжите обучение с того места, где остановились./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Продолжить обучение/i })).toBeInTheDocument();
  });
});
