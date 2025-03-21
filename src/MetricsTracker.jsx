// MetricsTracker.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Create a context for metrics
const MetricsContext = createContext();

// Generate a unique session ID for anonymous tracking
const generateSessionId = () => {
  const timestamp = new Date().getTime();
  const randomNum = Math.floor(Math.random() * 1000000);
  return `session-${timestamp}-${randomNum}`;
};

// Initialize or retrieve session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem("bitvoyager_session_id");
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem("bitvoyager_session_id", sessionId);
  }
  return sessionId;
};

export const MetricsProvider = ({ children }) => {
  const [sessionId] = useState(getSessionId);
  const challengeStartTimeRef = useRef(null);
  const [metrics, setMetrics] = useState(() => {
    const storedMetrics = localStorage.getItem("bitvoyager_metrics");
    return storedMetrics ? JSON.parse(storedMetrics) : {
      sessionId: sessionId,
      startTime: new Date(),
      attempts: 0,
      errors: 0,
      skips: 0,
      completedChallenges: 0,
      challengeDetails: [],
    };
  });

  // Save metrics to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("bitvoyager_metrics", JSON.stringify(metrics));
  }, [metrics]);

  // Start a new mode session
  const startMode = (mode) => {
    if (!mode || (mode !== "standard" && mode !== "learning")) {
      console.error("Invalid mode:", mode);
      return;
    }

    // Set a timestamp for the first challenge
    challengeStartTimeRef.current = new Date();
  };

  // Complete current mode
  const completeMode = () => {
    challengeStartTimeRef.current = null;
  };

  // Record an attempt
  const recordAttempt = (success = false) => {
    setMetrics((prev) => ({
      ...prev,
      attempts: prev.attempts + 1,
      errors: prev.errors + (success ? 0 : 1),
    }));
  };

  // Record a skip
  const recordSkip = () => {
    setMetrics((prev) => ({
      ...prev,
      skips: prev.skips + 1,
    }));
  };

  // Record challenge completion
  const recordChallengeCompletion = (challengeId, difficulty, attempts) => {
    const endTime = new Date();
    const timeSpent = challengeStartTimeRef.current
      ? (endTime - challengeStartTimeRef.current) / 1000 // in seconds
      : 0;

    setMetrics((prev) => ({
      ...prev,
      completedChallenges: prev.completedChallenges + 1,
      challengeDetails: [
        ...prev.challengeDetails,
        {
          challengeId,
          difficulty,
          timeSpent,
          attempts,
          completedAt: endTime.toISOString(),
        },
      ],
    }));

    // Immediately reset the start time for the next challenge
    challengeStartTimeRef.current = new Date();
  };
  // Start a new challenge (reset timer)
  const startChallenge = () => {
    challengeStartTimeRef.current = new Date();
  };

  // Get all metrics data
  const getMetricsData = () => {
    const timeExport = new Date();
    const duration = (timeExport - metrics.startTime) / 1000;
    return {
      ...metrics,
      exportTime: timeExport,
      duration: duration,
    };
  };

  // Export metrics for download
  const exportMetrics = () => {
    const data = getMetricsData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bitvoyager_metrics_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return data;
  };

  // Reset metrics completely (for testing)
  const resetMetrics = () => {
    const newSessionId = generateSessionId();
    localStorage.setItem("bitvoyager_session_id", newSessionId);

    const newMetrics = {
      sessionId: newSessionId,
      startTime: new Date().toISOString(),
      attempts: 0,
      errors: 0,
      skips: 0,
      completedChallenges: 0,
      challengeDetails: [],
    };

    setMetrics(newMetrics);
    localStorage.setItem("bitvoyager_metrics", JSON.stringify(newMetrics));
    return newSessionId;
  };

  return (
    <MetricsContext.Provider
      value={{
        sessionId,
        metrics,
        startMode,
        completeMode,
        recordAttempt,
        recordSkip,
        recordChallengeCompletion,
        startChallenge,
        getMetricsData,
        exportMetrics,
        resetMetrics,
      }}
    >
      {children}
    </MetricsContext.Provider>
  );
};

export const useMetrics = () => useContext(MetricsContext);

// Helper hook for tracking time on a specific challenge
export const useChallengeTiming = (challengeId, difficulty) => {
  const {
    recordChallengeCompletion,
    recordAttempt,
    recordSkip,
    startChallenge,
  } = useMetrics();
  const [attempts, setAttempts] = useState(0);

  // Start timing when the component mounts
  useEffect(() => {
    startChallenge();
  }, [startChallenge]);

  const recordAttemptWithCount = (success = false) => {
    recordAttempt(success);
    setAttempts((prev) => prev + 1);
  };

  const completeChallenge = () => {
    recordChallengeCompletion(challengeId, difficulty, attempts);
  };

  return {
    recordAttempt: recordAttemptWithCount,
    recordSkip,
    completeChallenge,
  };
};

// Export a simple button component that can be used to show metrics or export them
export const MetricsExportButton = ({ className }) => {
  const { exportMetrics } = useMetrics();

  return (
    <button
      onClick={exportMetrics}
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
        className || ""
      }`}
    >
      Export Study Data
    </button>
  );
};
