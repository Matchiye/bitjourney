import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle, Code, Moon, Rocket, Star, XCircle } from "lucide-react";

import { Link } from "react-router-dom";

import PythonCodeEditor from "./PythonCodeEditor";

// StarBackground component remains the same
const StarBackground = React.memo(() => {
  const stars = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 8 + 2,
      delay: `${Math.random() * 4}s`,
      duration: `${Math.random() * 2 + 2}s`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 w-full h-full">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute text-yellow-200 opacity-0"
            style={{
              left: star.left,
              top: star.top,
              animation: `twinkle ${star.duration} ease-in-out infinite`,
              animationDelay: star.delay,
            }}
            size={star.size}
          />
        ))}
      </div>
    </div>
  );
});

// Add keyframe animation
const style = document.createElement("style");
style.textContent = `
  @keyframes twinkle {
    0%, 100% { 
      opacity: 0;
      transform: scale(0.5);
    }
    50% { 
      opacity: 0.7;
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);

const PythonQuestionRenderer = (
  {
    question,
    onMissionComplete,
    onTestAttempt,
    onSkip,
    progressInfo,
    onCodeChange,
  },
) => {
  // All hooks must be at the top level
  const [pyodide, setPyodide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState(question.code);
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [allTestsPassed, setAllTestsPassed] = useState(null);

  // Maintain a reference to the initial code to avoid unnecessary updates
  const initialCodeRef = useRef(question.code);

  // Define callbacks before useEffect
  const runTests = useCallback(async () => {
    if (!pyodide) {
      setOutput("Python runtime is still loading...");
      return;
    }

    try {
      setError(null);
      setTestResults([]);

      const sanitizedCode = code.replace(/\u00A0/g, " ");
      const codeLines = sanitizedCode.split("\n");
      const properlyIndentedCode = codeLines.map((line) => {
        if (
          line.trim() && !line.startsWith("    ") && !line.startsWith("def ")
        ) {
          return "    " + line;
        }
        return line;
      }).join("\n");

      await pyodide.runPythonAsync(properlyIndentedCode);

      const results = [];
      let allPassed = true;

      for (const testCase of question.testCases) {
        try {
          const functionName = question.functionName;
          const inputArgs = testCase.input.map((item) => JSON.stringify(item))
            .join(",");
          const testWrapper = `
result = ${functionName}(${inputArgs})
str(result)`.trim();

          console.log(testWrapper);
          const result = await pyodide.runPythonAsync(testWrapper);
          const parsedResult = result;

          const expectedResult = await pyodide.runPythonAsync(
            `str(${JSON.stringify(testCase.output)})`,
          );

          const passed = parsedResult === expectedResult;

          console.log(result);
          console.log(parsedResult);

          results.push({
            input: testCase.input,
            expectedOutput: expectedResult,
            actualOutput: parsedResult,
            passed,
          });

          if (!passed) {
            allPassed = false;
          }
        } catch (err) {
          results.push({
            input: testCase.input,
            expectedOutput: JSON.stringify(testCase.output),
            actualOutput: "Error: " + err.message,
            passed: false,
          });
          allPassed = false;
        }
      }

      setTestResults(results);
      setAllTestsPassed(allPassed);

      if (onTestAttempt) {
        onTestAttempt(allPassed);
      }
    } catch (err) {
      setError(err.message);
      setAllTestsPassed(false);

      if (onTestAttempt) {
        onTestAttempt(false);
      }
    }
  }, [pyodide, code, question, onTestAttempt]);

  // Initialize code only when the question ID changes, not on every render
  useEffect(() => {
    // Only update the code state if the question ID has changed
    if (initialCodeRef.current !== question.code) {
      console.log("Question code changed, updating editor");
      setCode(question.code);
      initialCodeRef.current = question.code;
    }
  }, [question.id, question.code]);

  // Handle code changes, propagating to parent component
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (onCodeChange) {
      onCodeChange(newCode);
    }
  };

  // Load Pyodide
  useEffect(() => {
    async function loadPyodideRuntime() {
      if (globalThis.pyodide) {
        setPyodide(globalThis.pyodide);
        setLoading(false);
        return;
      }

      try {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.0/full/pyodide.js";
        script.onload = async () => {
          const loadPyodide = globalThis.loadPyodide;
          const pyodideInstance = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.0/full/",
          });
          globalThis.pyodide = pyodideInstance;
          setPyodide(pyodideInstance);
          setLoading(false);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error("Error loading Pyodide:", error);
        setError("Failed to load Python runtime. Please refresh the page.");
        setLoading(false);
      }
    }

    loadPyodideRuntime();
  }, []);

  // Early return if question is not loaded
  if (!question) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Rocket className="w-12 h-12 text-blue-400 animate-bounce mx-auto" />
          <p className="text-blue-200 text-xl">Loading Mission...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full">
      <StarBackground />

      {/* Main content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="absolute top-8 left-8">
          <Link
            to="/"
            className="text-blue-200 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            <span className="text-lg">&lt;</span>
            <span>Return to Home</span>
          </Link>
        </nav>
        {/* Header Section */}
        <header className="w-full flex flex-col items-center justify-center py-8">
          <div className="flex items-center space-x-4 mb-6">
            <Rocket className="w-12 h-12 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">
              The Practice Space
            </h1>
          </div>
          <div className="flex items-center space-x-6">
            <p className="text-blue-200 text-xl">
              You're on mission control duty!
            </p>
            <div className="flex items-center space-x-2 bg-slate-800 px-4 py-2 rounded-full border border-blue-500/30">
              <span className="text-blue-400">Mission</span>
              <span className="text-white font-bold">
                {progressInfo.current}
              </span>
              <span className="text-blue-400">of</span>
              <span className="text-white font-bold">{progressInfo.total}</span>
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <div className="max-w-4xl mx-auto px-4 pb-12">
          {/* Mission Overview Card */}
          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-6 mb-8 border border-blue-500 shadow-lg shadow-blue-500/20">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <h2 className="text-3xl font-bold text-white flex items-center">
                  <Moon className="mr-3 text-blue-400 w-8 h-8" />
                  Mission Briefing
                </h2>
                <div
                  className={`px-4 py-1 rounded-full text-sm font-semibold ${
                    question.difficulty === "easy"
                      ? "bg-green-900 text-green-300"
                      : question.difficulty === "medium"
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {question.difficulty.charAt(0).toUpperCase() +
                    question.difficulty.slice(1)}
                </div>
              </div>
              <div className="flex space-x-2">
                {question.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-blue-100 space-y-6">
              <div className="bg-slate-700 bg-opacity-50 p-6 rounded-lg border border-blue-500/30">
                <p className="text-lg leading-relaxed whitespace-pre-line">
                  {question.question}
                </p>
              </div>

              <div className="bg-slate-700 bg-opacity-50 p-6 rounded-lg border border-blue-500/30">
                <h3 className="text-xl font-semibold mb-4 text-blue-300">
                  Mission Objectives:
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <div className="w-2 h-2 mt-2 mr-3 bg-blue-400 rounded-full">
                    </div>
                    Write a Python function that solves the given problem
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 mt-2 mr-3 bg-blue-400 rounded-full">
                    </div>
                    Test your solution against the provided test cases
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 mt-2 mr-3 bg-blue-400 rounded-full">
                    </div>
                    Achieve all test cases passing to complete the mission
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Code Editor Card */}
          <div className="bg-slate-800 bg-opacity-90 rounded-lg p-6 mb-8 border border-blue-500 shadow-lg shadow-blue-500/20">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center">
              <Code className="mr-2 text-blue-400" />
              Mission Control Center
              {progressInfo.attempts > 0 && (
                <span className="ml-4 px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">
                  Attempts: {progressInfo.attempts}
                </span>
              )}
              {progressInfo.isRetry && (
                <span className="ml-4 px-3 py-1 bg-purple-900 text-purple-200 rounded-full text-sm">
                  Another chance !
                </span>
              )}
              {progressInfo.previouslyFailed && (
                <span className="ml-4 px-3 py-1 bg-red-900 text-red-200 rounded-full text-sm">
                  Previous Attempts:{" "}
                  {progressInfo.userProfile?.failedAttempts[question.id] || 0}
                </span>
              )}
            </h2>

            <PythonCodeEditor
              initialCode={code}
              onCodeChange={handleCodeChange}
              className="mb-6"
            />

            <div className="flex justify-end space-x-4">
              <button
                onClick={() =>
                  onSkip ? onSkip() : onMissionComplete(false, true)}
                className="text-slate-400 underline hover:text-slate-300 transition-colors flex items-center space-x-2"
              >
                <span>Skip this question</span>
              </button>
              <button
                onClick={runTests}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-600 transition-colors flex items-center space-x-2"
              >
                <Rocket className="w-5 h-5" />
                <span>{loading ? "Preparing Launch..." : "Launch Tests"}</span>
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900 bg-opacity-90 text-red-100 p-4 rounded-lg mb-8 border border-red-500">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-2" />
                <span>Mission Alert: {error}</span>
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="bg-slate-800 bg-opacity-90 rounded-lg p-6 border border-blue-500 shadow-lg shadow-blue-500/20">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Mission Results
              </h2>

              {allTestsPassed
                ? (
                  <div className="space-y-6">
                    <div className="bg-green-900 bg-opacity-50 p-4 rounded-md border border-green-500">
                      <div className="flex items-center text-green-300">
                        <CheckCircle className="w-6 h-6 mr-2" />
                        <span className="text-lg font-semibold">
                          Mission Accomplished! All tests passed! 🚀
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => onMissionComplete(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2 group"
                      >
                        <Rocket className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        <span>Continue to Next Mission</span>
                      </button>
                    </div>
                  </div>
                )
                : (
                  <div>
                    {testResults.find((result) => !result.passed) && (
                      <div className="p-4 rounded-md bg-red-900 bg-opacity-50 border-red-500 border">
                        <div className="flex items-center mb-2">
                          <XCircle className="w-5 h-5 text-red-400 mr-2" />
                          <h3 className="text-white font-medium">
                            Mission Check Failed
                          </h3>
                        </div>

                        {(() => {
                          const failedTest = testResults.find((result) =>
                            !result.passed
                          );
                          const index = testResults.indexOf(failedTest);
                          return (
                            <div className="space-y-2 text-slate-200">
                              <p className="text-red-300 mb-4">
                                Test case {index + 1}{" "}
                                did not produce the expected output:
                              </p>
                              <p>
                                <span className="text-blue-400">Input:</span>
                                {" "}
                                {failedTest.input.join(", ")}
                              </p>
                              <p>
                                <span className="text-blue-400">Expected:</span>
                                {" "}
                                {failedTest.expectedOutput}
                              </p>
                              <p>
                                <span className="text-blue-400">Actual:</span>
                                {" "}
                                {failedTest.actualOutput}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default PythonQuestionRenderer;
