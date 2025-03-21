import React, { useEffect, useRef, useState } from "react";
import {
  getUserProfile,
  ModeSelection,
  saveUserProfile,
  selectQuestions,
  updateSkillLevels,
} from "./LearningModePython";
import PythonQuestion from "./PythonQuestion";
import PythonQuestionRenderer from "./PythonQuestionRenderer";
import {
  BarChart2,
  RefreshCw,
  Rocket,
  Star,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  MetricsExportButton,
  MetricsProvider,
  useMetrics,
} from "./MetricsTracker";

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

// Helper function to initialize questions
const initializeQuestions = (mode, userProfile = null) => {
  try {
    // Get all questions
    const allQuestions = {};
    for (let i = 1; i <= 29; i++) {
      try {
        allQuestions[i] = PythonQuestion(i);
      } catch (e) {
        console.warn(`Could not load question ${i}:`, e);
      }
    }

    // Select questions based on mode
    const selectedQuestions = selectQuestions(mode, userProfile, allQuestions);

    if (!selectedQuestions) {
      throw new Error("Could not find enough suitable questions");
    }

    return {
      questions: selectedQuestions,
      allQuestions,
      error: null,
    };
  } catch (error) {
    return { questions: [], allQuestions: {}, error: error.message };
  }
};

const PythonWithMetrics = () => {
  const [mode, setMode] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentMissionIndex, setCurrentMissionIndex] = useState(0);
  const [missionComplete, setMissionComplete] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState({});
  const [error, setError] = useState(null);
  const [completedDifficulties, setCompletedDifficulties] = useState([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [showMetricsExport, setShowMetricsExport] = useState(false);

  // This will store user code for each question to prevent it from being reset
  const [userCodeMap, setUserCodeMap] = useState({});

  // Keep track of whether questions have been initialized
  const questionsInitialized = useRef(false);

  // Get metrics tracking functions
  const {
    startMode,
    completeMode,
    recordAttempt,
    recordSkip,
    recordChallengeCompletion, // Add this line to destructure the function
  } = useMetrics();
  // Initialize based on selected mode
  useEffect(() => {
    if (!mode) return;

    // Start tracking this mode session
    startMode(mode.toLowerCase());

    let profile = null;
    if (mode === "learning") {
      profile = getUserProfile();
      setUserProfile(profile);
    }

    const { questions, allQuestions, error } = initializeQuestions(
      mode,
      profile,
    );

    // Only set selected questions if this is the first initialization or if there's an error
    if (!questionsInitialized.current || error) {
      setSelectedQuestions(questions);
      setAllQuestions(allQuestions);
      setError(error);
      questionsInitialized.current = true;

      // Initialize user code map with initial question code
      const initialCodeMap = {};
      questions.forEach((question) => {
        initialCodeMap[question.id] = question.code;
      });
      setUserCodeMap(initialCodeMap);
    }
  }, [mode, startMode]);

  const handleMissionComplete = (completed = false, skipped = false) => {
    if (skipped) {
      recordSkip();
    }

    // Record challenge completion metrics only for successful completions
    if (
      completed && !skipped && currentMissionIndex < selectedQuestions.length
    ) {
      const currentQuestion = selectedQuestions[currentMissionIndex];
      // Use the metrics system to record completion
      recordChallengeCompletion(
        currentQuestion.id,
        currentQuestion.difficulty,
        currentAttempts,
      );
    }

    if (mode === "standard") {
      handleStandardModeComplete(completed);
    } else {
      handleLearningModeComplete(completed, skipped);
    }
  };

  const handleStandardModeComplete = (completed) => {
    if (currentMissionIndex < selectedQuestions.length - 1) {
      if (completed) {
        setCompletedDifficulties(
          (prev) => [...prev, DIFFICULTY_ORDER[currentMissionIndex]],
        );
      }
      setCurrentMissionIndex((prev) => prev + 1);
      setCurrentAttempts(0); // Reset attempts for new question
    } else {
      if (completed) {
        setCompletedDifficulties(
          (prev) => [...prev, DIFFICULTY_ORDER[currentMissionIndex]],
        );
      }
      setMissionComplete(true);
      completeMode(); // Mark the mode as complete in metrics
      setShowMetricsExport(true); // Show export button when completing missions
    }
  };

  const handleLearningModeComplete = (completed, skipped = false) => {
    if (!userProfile || !selectedQuestions[currentMissionIndex]) return;

    const currentQuestion = selectedQuestions[currentMissionIndex];
    const attempts = skipped ? 0 : currentAttempts + 1;

    // Update profile with current question result
    const updatedProfile = updateSkillLevels(
      userProfile,
      currentQuestion,
      completed,
      attempts,
      skipped,
    );

    if (completed) {
      updatedProfile.completedQuestions.push(currentQuestion.id);
    }

    // Save updated profile
    saveUserProfile(updatedProfile);
    setUserProfile(updatedProfile);

    if (currentMissionIndex < selectedQuestions.length - 1) {
      // Move to next question
      setCurrentMissionIndex((prev) => prev + 1);
      setCurrentAttempts(0); // Reset attempts for new question
    } else {
      // Update streak
      const today = new Date().toDateString();
      if (updatedProfile.lastSessionDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (updatedProfile.lastSessionDate === yesterday.toDateString()) {
          updatedProfile.consecutiveDays += 1;
        } else {
          updatedProfile.consecutiveDays = 1;
        }
        updatedProfile.lastSessionDate = today;
        saveUserProfile(updatedProfile);
      }

      setMissionComplete(true);
      completeMode(); // Mark the mode as complete in metrics
      setShowMetricsExport(true); // Show export button when completing missions
    }
  };

  const handleTestAttempt = (success) => {
    setCurrentAttempts((prev) => prev + 1);
    recordAttempt(success);
  };

  const handleSkip = () => {
    handleMissionComplete(false, true);
  };

  // Handle code changes and update the userCodeMap
  const handleCodeChange = (questionId, newCode) => {
    setUserCodeMap((prev) => ({
      ...prev,
      [questionId]: newCode,
    }));
  };

  // Reset study button handler
  const handleResetStudy = () => {
    localStorage.removeItem("pythonLearningProfile");
    localStorage.removeItem("bitvoyager_session_id");
    localStorage.removeItem("bitvoyager_metrics");
    globalThis.location.reload();
  };

  const handleSuccessfulCompletion = (questionId, difficulty) => {
    // Record the successful challenge completion in metrics
    recordChallengeCompletion(
      questionId,
      difficulty,
      currentAttempts,
    );

    handleMissionComplete(true, false);
  };

  if (!mode) {
    return (
      <div>
        <ModeSelection onModeSelect={setMode} />
        <div className="fixed bottom-4 right-4 flex space-x-2">
          <button
            onClick={handleResetStudy}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reset Study
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl text-white font-bold">
            Mission Initialization Failed
          </h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Retry Mission</span>
          </button>
        </div>
      </div>
    );
  }

  if (missionComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-95">
        <div className="text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <Trophy className="w-32 h-32 text-yellow-400 animate-bounce" />
              <div className="absolute inset-0 animate-ping">
                <Trophy className="w-32 h-32 text-yellow-400 opacity-50" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white">Mission Complete!</h1>

          {showMetricsExport && (
            <div className="mt-6">
              <p className="text-white mb-4">
                If you are on your third completion, please remember to export
                your study data before continuing:
              </p>
              <MetricsExportButton className="mb-6" />
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto group"
          >
            <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span>Start New Journey</span>
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = selectedQuestions[currentMissionIndex];

  if (!currentQuestion) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-300 text-xl">
            No question available. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  // Get user's current code for this question or use the default if not yet modified
  const currentCode = userCodeMap[currentQuestion.id] || currentQuestion.code;

  return (
    <>
      <PythonQuestionRenderer
        key={`question-${currentQuestion.id}-index-${currentMissionIndex}`}
        question={{ ...currentQuestion, code: currentCode }}
        onCodeChange={(newCode) =>
          handleCodeChange(currentQuestion.id, newCode)}
        onMissionComplete={(completed, skipped = false) => {
          // Call the test attempt tracking first if this was a successful completion
          if (completed && !skipped) {
            handleTestAttempt(true);
          }
          handleMissionComplete(completed, skipped);
        }}
        onTestAttempt={handleTestAttempt}
        onSkip={handleSkip}
        progressInfo={{
          current: currentMissionIndex + 1,
          total: selectedQuestions.length,
          difficulty: mode === "standard"
            ? DIFFICULTY_ORDER[currentMissionIndex]
            : currentQuestion.difficulty,
          completedDifficulties,
          mode,
          userProfile: mode === "learning" ? userProfile : null,
          attempts: currentAttempts,
          isRetry: mode === "learning" &&
            userProfile?.skippedQuestions?.includes(currentQuestion.id),
          previouslyFailed: mode === "learning" &&
            (userProfile?.failedAttempts?.[currentQuestion.id] || 0) > 0,
        }}
      />

      {/* Fixed position metrics button for admin/testing */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => setShowMetricsExport((prev) => !prev)}
          className="p-2 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700"
          title="Show metrics options"
        >
          <BarChart2 className="w-5 h-5" />
        </button>

        {showMetricsExport && (
          <div className="absolute bottom-12 right-0 bg-slate-800 p-4 rounded-lg shadow-lg">
            <p className="text-white text-sm mb-2">Study Data</p>
            <MetricsExportButton />
          </div>
        )}
      </div>
    </>
  );
};

// Remember to make sure the component is wrapped with MetricsProvider
// in your component hierarchy
const Python = () => (
  <MetricsProvider>
    <PythonWithMetrics />
  </MetricsProvider>
);

export default Python;
