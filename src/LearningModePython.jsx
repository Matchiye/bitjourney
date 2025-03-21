import { Brain, Rocket } from "lucide-react";

// Mode Selection Component (preserved from original)
const ModeSelection = ({ onModeSelect }) => {
  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-4xl font-bold text-white text-center mb-12">
          Choose Your Learning Path
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button
            onClick={() => onModeSelect("standard")}
            className="bg-blue-600 hover:bg-blue-700 transition-colors p-8 rounded-lg text-left group"
          >
            <div className="flex items-center mb-4">
              <h2 className="text-2xl font-semibold text-white">
                Mode 1
              </h2>
            </div>
          </button>

          <button
            onClick={() => onModeSelect("learning")}
            className="bg-purple-600 hover:bg-purple-700 transition-colors p-8 rounded-lg text-left group"
          >
            <div className="flex items-center mb-4">
              <h2 className="text-2xl font-semibold text-white">
                Mode 2
              </h2>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced user profile structure
const defaultUserProfile = {
  completedQuestions: [],
  skippedQuestions: [], // New: Track skipped questions
  failedAttempts: {}, // New: Track number of failed attempts per question
  skillLevels: {
    "loops": 0,
    "list manipulation": 0,
    "strings": 0,
    "hash tables": 0,
    "arrays": 0,
    "recursion": 0,
    "dynamic programming": 0,
    "binary search": 0,
    "matrix": 0,
    "sorting": 0,
  },
  questionHistory: {}, // New: Track detailed question history
  lastSessionDate: null,
  consecutiveDays: 0,
};

// Helper functions for profile management
const getUserProfile = () => {
  const storedProfile = localStorage.getItem("pythonLearningProfile");
  if (storedProfile) {
    return JSON.parse(storedProfile);
  }
  return defaultUserProfile;
};

const saveUserProfile = (profile) => {
  localStorage.setItem("pythonLearningProfile", JSON.stringify(profile));
};

// Helper function for difficulty score conversion
const getDifficultyScore = (difficulty) => {
  switch (difficulty) {
    case "easy":
      return 3;
    case "medium":
      return 6;
    case "hard":
      return 9;
    default:
      return 5;
  }
};

// Skill adjustment calculation for learning mode
const calculateSkillAdjustment = (
  profile,
  question,
  success,
  attempts = 1,
  skipped = false,
) => {
  const baseIncrease = 1.0;
  const baseDecrease = -0.5;

  const SKIP_PENALTY = 0.7;
  const DIFFICULTY_MULTIPLIER = {
    "easy": 0.8,
    "medium": 1.0,
    "hard": 1.2,
  };
  const ATTEMPT_PENALTY = 0.15;

  let adjustment = success ? baseIncrease : baseDecrease;
  adjustment *= DIFFICULTY_MULTIPLIER[question.difficulty];

  if (success && attempts > 1) {
    adjustment *= Math.max(0.2, 1 - (attempts - 1) * ATTEMPT_PENALTY);
  }

  if (skipped) {
    adjustment *= SKIP_PENALTY;
  }

  return adjustment;
};

// Enhanced skill level update function
const updateSkillLevels = (
  profile,
  question,
  success,
  attempts = 1,
  skipped = false,
) => {
  if (!profile) return null;
  const updatedProfile = { ...profile };

  const adjustment = calculateSkillAdjustment(
    profile,
    question,
    success,
    attempts,
    skipped,
  );

  question.tags.forEach((tag) => {
    if (updatedProfile.skillLevels[tag] !== undefined) {
      updatedProfile.skillLevels[tag] = Math.max(
        0,
        Math.min(10, updatedProfile.skillLevels[tag] + adjustment),
      );
    }
  });

  const timestamp = new Date().toISOString();
  updatedProfile.questionHistory[question.id] = {
    ...(updatedProfile.questionHistory[question.id] || {}),
    lastAttempt: timestamp,
    attempts: (updatedProfile.questionHistory[question.id]?.attempts || 0) + 1,
    success: success,
    skipped: skipped,
  };

  if (skipped) {
    if (!updatedProfile.skippedQuestions.includes(question.id)) {
      updatedProfile.skippedQuestions.push(question.id);
    }
  } else if (success) {
    updatedProfile.skippedQuestions = updatedProfile.skippedQuestions.filter(
      (id) => id !== question.id,
    );
  }

  if (!success && !skipped) {
    updatedProfile.failedAttempts[question.id] =
      (updatedProfile.failedAttempts[question.id] || 0) + 1;
  }

  if (success) {
    delete updatedProfile.failedAttempts[question.id];
  }

  return updatedProfile;
};

// Question selection based on mode
const selectQuestions = (mode, profile, allQuestions) => {
  if (!allQuestions) {
    console.error("No questions provided");
    return null;
  }

  if (mode === "standard") {
    return selectStandardQuestions(allQuestions);
  } else if (mode === "learning") {
    if (!profile) {
      console.error("No profile provided for learning mode");
      return null;
    }
    return selectLearningQuestions(profile, allQuestions);
  } else {
    console.error("Invalid mode selected:", mode);
    return null;
  }
};

// Standard mode question selection (preserved from original)
const selectStandardQuestions = (allQuestions) => {
  if (!allQuestions) {
    console.error("No questions provided");
    return null;
  }

  try {
    // Convert the questions object to an array
    const questionsArray = Object.entries(allQuestions)
      .map(([id, q]) => ({ id: parseInt(id), ...q }));

    // Check if we have any questions
    if (questionsArray.length === 0) {
      throw new Error("No questions found");
    }

    // Check if we have at least 3 questions
    if (questionsArray.length < 3) {
      throw new Error(
        `Not enough questions: only ${questionsArray.length} available`,
      );
    }

    // Select 3 random questions
    const selected = [];
    const questionCount = 3;

    // Create a copy of the array to avoid modifying the original
    const availableQuestions = [...questionsArray];

    for (let i = 0; i < questionCount; i++) {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      selected.push(availableQuestions[randomIndex]);

      // Remove the selected question to avoid duplicates
      availableQuestions.splice(randomIndex, 1);
    }

    return selected;
  } catch (error) {
    console.error(error.message);
    return null;
  }
};

// Learning mode question selection
const selectLearningQuestions = (profile, allQuestions) => {
  // Validate inputs
  if (!profile || !allQuestions) {
    console.error("Missing required parameters:", {
      profile: !!profile,
      allQuestions: !!allQuestions,
    });
    return null;
  }

  // Initialize history-related fields if they don't exist
  if (!profile.questionHistory) profile.questionHistory = {};
  if (!profile.skippedQuestions) profile.skippedQuestions = [];
  if (!profile.failedAttempts) profile.failedAttempts = {};

  const availableQuestions = Object.entries(allQuestions)
    .filter(([id]) =>
      !isNaN(id) && !profile.completedQuestions.includes(parseInt(id))
    )
    .map(([id, question]) => ({ id: parseInt(id), ...question }));

  if (availableQuestions.length < 3) return null;

  // Separate retry questions from new questions
  const retryQuestionScores = [];
  const newQuestionScores = [];

  availableQuestions.forEach((question) => {
    let score = 0;

    // 1. Skill level matching (0-50 points)
    const avgSkillForTags = question.tags.reduce((sum, tag) =>
      sum + (profile.skillLevels[tag] || 0), 0) / question.tags.length;
    const difficultyScore = getDifficultyScore(question.difficulty);
    score += 50 * (1 - Math.abs(avgSkillForTags - difficultyScore) / 10);

    // 2. Tag diversity bonus (0-20 points)
    const uniqueTags = new Set(question.tags);
    const recentQuestions = Object.values(profile.questionHistory)
      .sort((a, b) =>
        new Date(b.lastAttempt) - new Date(a.lastAttempt)
      )
      .slice(0, 5);
    const recentTags = new Set(recentQuestions.flatMap((q) =>
      q.tags || []
    ));
    const newTagBonus =
      [...uniqueTags].filter((tag) => !recentTags.has(tag)).length * 5;
    score += Math.min(20, newTagBonus);

    // 3. Difficulty progression check
    const avgSkillLevel =
      Object.values(profile.skillLevels).reduce((a, b) => a + b, 0) /
      Object.values(profile.skillLevels).length;
    if (
      (question.difficulty === "hard" && avgSkillLevel < 7) ||
      (question.difficulty === "medium" && avgSkillLevel < 3)
    ) {
      score -= 50;
    }

    const isRetryQuestion = profile.skippedQuestions.includes(question.id) ||
      (profile.failedAttempts[question.id] || 0) > 0;

    if (isRetryQuestion) {
      // Additional scoring for retry questions
      if (profile.skippedQuestions.includes(question.id)) {
        const timeSinceSkip = profile.questionHistory[question.id]
          ? Date.now() -
            new Date(profile.questionHistory[question.id].lastAttempt)
          : Infinity;
        const daysElapsed = timeSinceSkip / (1000 * 60 * 60 * 24);
        score += Math.min(20, daysElapsed * 2);
      }

      const failedAttempts = profile.failedAttempts[question.id] || 0;
      if (failedAttempts > 0) {
        const timeSinceLastAttempt = profile.questionHistory[question.id]
          ? Date.now() -
            new Date(profile.questionHistory[question.id].lastAttempt)
          : Infinity;
        const daysElapsed = timeSinceLastAttempt / (1000 * 60 * 60 * 24);
        score -= Math.max(0, 30 - daysElapsed * 3);
      }

      retryQuestionScores.push({ question, score });
    } else {
      newQuestionScores.push({ question, score });
    }
  });

  // Sort both arrays by score
  newQuestionScores.sort((a, b) => b.score - a.score);
  retryQuestionScores.sort((a, b) => b.score - a.score);

  const selectedQuestions = [];

  // First, select two new questions
  for (let i = 0; i < 2; i++) {
    if (newQuestionScores.length > i) {
      selectedQuestions.push(newQuestionScores[i].question);
    }
  }

  // Then, add one retry question if available, otherwise add another new question
  if (retryQuestionScores.length > 0 && retryQuestionScores[0].score > 20) {
    selectedQuestions.push(retryQuestionScores[0].question);
  } else if (newQuestionScores.length > 2) {
    selectedQuestions.push(newQuestionScores[2].question);
  }

  return selectedQuestions;
};

export {
  calculateSkillAdjustment,
  defaultUserProfile,
  getUserProfile,
  ModeSelection,
  saveUserProfile,
  selectQuestions,
  updateSkillLevels,
};
