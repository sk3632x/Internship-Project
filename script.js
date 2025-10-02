const API_KEY = "AIzaSyBQZOtHX6cTMlH9JM0EceojSSXhqc-7iIM";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

let quizState = {
  userType: "",
  topic: "",
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  startTime: null,
  timerInterval: null,
  timeLimit: 0,
  questionCount: 5,
  userAnswers: [],
};

const welcomeScreen = document.getElementById("welcomeScreen");
const quizScreen = document.getElementById("quizScreen");
const resultsScreen = document.getElementById("resultsScreen");
const userCards = document.querySelectorAll(".user-card");
const topicInputSection = document.getElementById("topicInputSection");
const topicInputField = document.getElementById("topicInput");
const questionCountInput = document.getElementById("questionCountInput");
const generateQuizBtn = document.getElementById("generateQuizBtn");
const fullscreenLoading = document.getElementById("fullscreenLoading");
const timerEl = document.getElementById("timer");
const timerContainer = document.getElementById("timerContainer");
const progressBar = document.getElementById("progressBar");
const questionText = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const submitBtn = document.getElementById("submitBtn");
const unansweredTracker = document.getElementById("unansweredTracker");
const currentQuestionSpan = document.getElementById("currentQuestion");
const totalQuestionsSpan = document.getElementById("totalQuestions");
const userBadge = document.getElementById("userBadge");
const topicBadge = document.getElementById("topicBadge");
const historyContainer = document.getElementById("historyContainer");
const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const themeToggle = document.getElementById("themeToggle");

function initializeTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initialTheme = prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", initialTheme);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
}

// Update theme based on OS preference, but only if the user hasn't manually set one.
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      const newTheme = e.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  });

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  displayHistory();
  toggleHistoryBtn.classList.add("collapsed");
});

themeToggle.addEventListener("click", toggleTheme);

userCards.forEach((card) => {
  card.addEventListener("click", () => selectUserType(card));
});

generateQuizBtn.addEventListener("click", generateQuiz);
nextBtn.addEventListener("click", nextQuestion);
prevBtn.addEventListener("click", previousQuestion);
submitBtn.addEventListener("click", endQuiz);
document.getElementById("retryBtn").addEventListener("click", retryQuiz);
document.getElementById("newTopicBtn").addEventListener("click", resetApp);

toggleHistoryBtn.addEventListener("click", function () {
  const historyContent = document.getElementById("historyContainer");
  historyContent.classList.toggle("collapsed");
  this.classList.toggle("collapsed");
});

clearHistoryBtn.addEventListener("click", function () {
  if (
    confirm(
      "Are you sure you want to delete all quiz history? This action cannot be undone."
    )
  ) {
    localStorage.removeItem("quizHistory");
    displayHistory();
  }
});

function selectUserType(selectedCard) {
  userCards.forEach((card) => card.classList.remove("selected"));
  selectedCard.classList.add("selected");
  quizState.userType = selectedCard.dataset.type;
  topicInputSection.classList.remove("hidden");
  topicInputField.focus();
  topicInputSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function generateQuiz() {
  const topic = topicInputField.value.trim();
  const questionCount = parseInt(questionCountInput.value, 10);

  if (!quizState.userType) {
    alert("Please select a profile.");
    return;
  }
  if (!topic) {
    alert("Please enter a topic.");
    return;
  }
  if (isNaN(questionCount) || questionCount < 3 || questionCount > 20) {
    alert("Please enter a number of questions between 3 and 20.");
    return;
  }

  quizState.topic = topic;
  quizState.questionCount = questionCount;
  quizState.timeLimit = questionCount * 60;

  fullscreenLoading.classList.remove("hidden");
  generateQuizBtn.disabled = true;

  try {
    const questions = await fetchQuestionsFromGemini();
    quizState.questions = questions;
    fullscreenLoading.classList.add("hidden");
    startQuiz();
  } catch (error) {
    console.error("Error generating quiz:", error);
    alert("Failed to generate quiz. " + error.message);
    fullscreenLoading.classList.add("hidden");
    generateQuizBtn.disabled = false;
  }
}

// Constructs a detailed prompt for the Gemini API to ensure the response is in the correct JSON format with the specified number of questions and difficulty.
async function fetchQuestionsFromGemini() {
  const difficultyLevel = {
    student: "beginner to intermediate",
    educator: "intermediate to advanced",
    professional: "expert",
  };

  const prompt = `Create a multiple-choice quiz with exactly ${
    quizState.questionCount
  } questions about "${quizState.topic}".

The target audience is a ${quizState.userType}, so the difficulty should be ${
    difficultyLevel[quizState.userType]
  }.

Each question must have exactly 4 options. The 'correctAnswer' must be the 0-based index of the correct option.

Respond ONLY with a valid JSON object in the specified format, without any markdown, code blocks, or extra text.

JSON format:
{
  "questions": [
    {
      "question": "Sample question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}`;

  const response = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`API Request Failed: ${errorData.error.message}`);
  }

  const data = await response.json();
  const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);

  if (!parsedData.questions || parsedData.questions.length === 0) {
    throw new Error("Invalid or empty question data received from API.");
  }

  return parsedData.questions;
}

function startQuiz() {
  quizState.currentQuestionIndex = 0;
  quizState.score = 0;
  quizState.startTime = Date.now();
  quizState.userAnswers = new Array(quizState.questions.length).fill(undefined);

  welcomeScreen.classList.remove("active");
  resultsScreen.classList.remove("active");
  quizScreen.classList.add("active");

  userBadge.textContent =
    quizState.userType.charAt(0).toUpperCase() + quizState.userType.slice(1);
  topicBadge.textContent = quizState.topic;
  totalQuestionsSpan.textContent = quizState.questions.length;

  startTimer();
  displayQuestion();
}

function startTimer() {
  if (quizState.timerInterval) clearInterval(quizState.timerInterval);
  timerContainer.classList.remove("time-exceeded");

  quizState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - quizState.startTime) / 1000);
    const timeRemaining = quizState.timeLimit - elapsed;

    if (timeRemaining < 0) {
      timerContainer.classList.add("time-exceeded");
    }

    const minutes = Math.floor(Math.abs(timeRemaining) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (Math.abs(timeRemaining) % 60).toString().padStart(2, "0");

    timerEl.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

// This function handles all DOM manipulation for the current question.
// It updates the question text, progress bar, and navigation buttons.
// It also dynamically renders the answer options, applying styles based on whether
// the question has been answered and if the answer was correct or incorrect.
function displayQuestion() {
  const question = quizState.questions[quizState.currentQuestionIndex];
  currentQuestionSpan.textContent = quizState.currentQuestionIndex + 1;
  questionText.textContent = question.question;

  const progress =
    ((quizState.currentQuestionIndex + 1) / quizState.questions.length) * 100;
  progressBar.style.width = `${progress}%`;

  prevBtn.disabled = quizState.currentQuestionIndex === 0;
  nextBtn.disabled =
    quizState.currentQuestionIndex === quizState.questions.length - 1;

  optionsContainer.innerHTML = "";
  question.options.forEach((option, index) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "option";
    optionDiv.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + index)}</span>
      <span class="option-text">${option}</span>
    `;

    const userAnswer = quizState.userAnswers[quizState.currentQuestionIndex];
    if (userAnswer !== undefined) {
      // If answered, disable options and show correct/incorrect status.
      optionDiv.classList.add("disabled");
      if (index === userAnswer) {
        optionDiv.classList.add(
          userAnswer === question.correctAnswer ? "correct" : "incorrect"
        );
      }
      if (index === question.correctAnswer) {
        optionDiv.classList.add("correct");
      }
    } else {
      // If not answered, add click listener to select an option.
      optionDiv.addEventListener("click", () =>
        selectOption(index, question.correctAnswer)
      );
    }

    optionsContainer.appendChild(optionDiv);
  });

  updateUnansweredTracker();
  checkSubmissionState();
}

function selectOption(selectedIndex, correctIndex) {
  if (quizState.userAnswers[quizState.currentQuestionIndex] !== undefined) {
    return; // Prevent re-answering a question.
  }

  quizState.userAnswers[quizState.currentQuestionIndex] = selectedIndex;

  // Recalculate score based on all answers provided so far.
  let currentScore = 0;
  quizState.userAnswers.forEach((answer, index) => {
    if (answer === quizState.questions[index].correctAnswer) {
      currentScore++;
    }
  });
  quizState.score = currentScore;

  // Re-render the question to show correctness and disable options.
  displayQuestion();
}

function previousQuestion() {
  if (quizState.currentQuestionIndex > 0) {
    quizState.currentQuestionIndex--;
    displayQuestion();
  }
}

function nextQuestion() {
  if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
    quizState.currentQuestionIndex++;
    displayQuestion();
  }
}

function updateUnansweredTracker() {
  unansweredTracker.innerHTML = "<span>Unanswered: </span>";
  let hasUnanswered = false;

  quizState.questions.forEach((_, index) => {
    if (quizState.userAnswers[index] === undefined) {
      hasUnanswered = true;
      const qBtn = document.createElement("button");
      qBtn.textContent = index + 1;
      qBtn.className = "unanswered-q-btn";
      qBtn.addEventListener("click", () => {
        quizState.currentQuestionIndex = index;
        displayQuestion();
      });
      unansweredTracker.appendChild(qBtn);
    }
  });

  unansweredTracker.style.display = hasUnanswered ? "flex" : "none";
}

function checkSubmissionState() {
  const unansweredCount = quizState.userAnswers.filter(
    (a) => a === undefined
  ).length;
  submitBtn.disabled = unansweredCount > 0;
}

function endQuiz() {
  clearInterval(quizState.timerInterval);

  const totalTime = Math.floor((Date.now() - quizState.startTime) / 1000);
  const timeExceeded = Math.max(0, totalTime - quizState.timeLimit);

  quizScreen.classList.remove("active");
  resultsScreen.classList.add("active");

  displayResults(totalTime, timeExceeded);
  saveQuizHistory(totalTime, timeExceeded);
}

function displayResults(totalTime, timeExceeded) {
  const percentage = Math.round(
    (quizState.score / quizState.questions.length) * 100
  );

  document.getElementById("scorePercentage").textContent = `${percentage}%`;
  document.getElementById(
    "scoreText"
  ).textContent = `You scored ${quizState.score} out of ${quizState.questions.length}`;

  const minutes = Math.floor(totalTime / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalTime % 60).toString().padStart(2, "0");
  document.getElementById(
    "timeTaken"
  ).textContent = `⏱️ Time taken: ${minutes}:${seconds}`;

  if (timeExceeded > 0) {
    const extraMinutes = Math.floor(timeExceeded / 60)
      .toString()
      .padStart(2, "0");
    const extraSeconds = (timeExceeded % 60).toString().padStart(2, "0");
    document.getElementById(
      "extraTime"
    ).textContent = `⚠️ You exceeded the time limit by ${extraMinutes}:${extraSeconds}`;
    document.getElementById("extraTime").classList.remove("hidden");
  } else {
    document.getElementById("extraTime").classList.add("hidden");
  }

  const scoreCircle = document.getElementById("scoreCircle");
  const gradientDegree = (percentage / 100) * 360;
  scoreCircle.style.background = `conic-gradient(var(--primary-color) ${gradientDegree}deg, var(--bg-light) ${gradientDegree}deg)`;

  let message = "";
  if (percentage === 100) {
    message = "🌟 Perfect score! Outstanding performance!";
  } else if (percentage >= 80) {
    message = "🎯 Excellent work! You've mastered this topic!";
  } else if (percentage >= 60) {
    message = "👍 Good job! Keep practicing to improve further.";
  } else if (percentage >= 40) {
    message =
      "📚 Not bad, but there's room for improvement. Review the material and try again!";
  } else {
    message = "💪 Keep learning! Practice makes perfect. Don't give up!";
  }

  document.getElementById("performanceMessage").textContent = message;
}

function saveQuizHistory(totalTime, timeExceeded) {
  const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");

  const quizRecord = {
    userType: quizState.userType,
    topic: quizState.topic,
    score: quizState.score,
    total: quizState.questions.length,
    percentage: Math.round(
      (quizState.score / quizState.questions.length) * 100
    ),
    timeLimit: quizState.timeLimit,
    timeTaken: totalTime,
    timeExceeded: timeExceeded,
    date: new Date().toISOString(),
    questions: quizState.questions.map((q, index) => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: quizState.userAnswers[index],
    })),
  };

  history.unshift(quizRecord);
  if (history.length > 50) history.pop();

  localStorage.setItem("quizHistory", JSON.stringify(history));
  displayHistory();
}

// Renders the entire quiz history from localStorage into the DOM.
// This function uses template literals to build the HTML for each history item,
// including a detailed, expandable view for each question and answer.
function displayHistory() {
  const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");

  if (history.length === 0) {
    historyContainer.innerHTML =
      '<p class="no-history">📝 No quiz history yet. Take your first quiz!</p>';
    return;
  }

  historyContainer.innerHTML = history
    .map((quiz, index) => {
      const dateTime = formatDateTime(quiz.date);
      const timeDisplay =
        quiz.timeExceeded > 0
          ? `<span class="summary-stat" title="Time Details">
                <strong>Taken:</strong> (${formatTime(
                  quiz.timeLimit
                )}<span class="time-exceeded-text">+${formatTime(
              quiz.timeExceeded
            )}</span>)=${formatTime(quiz.timeTaken)}
               </span>`
          : `<span class="summary-stat" title="Time Details">
                <strong>Taken:</strong> ${formatTime(
                  quiz.timeTaken
                )} / ${formatTime(quiz.timeLimit)}
               </span>`;

      return `
        <div class="history-item">
            <div class="history-summary" onclick="toggleDetails(${index})">
                <span class="summary-main"><strong>${quiz.topic}</strong> (${
        quiz.userType
      })</span>
                <div class="summary-details">
                    <span class="summary-stat" title="Score"><strong>Score:</strong> ${
                      quiz.score
                    }/${quiz.total} (${quiz.percentage}%)</span>
                    ${timeDisplay}
                    <span class="summary-stat" title="Date"><strong>Date:</strong> ${
                      dateTime.date
                    }</span>
                    <span class="summary-stat" title="Time"><strong>Time:</strong> ${
                      dateTime.time
                    }</span>
                </div>
                <button class="expand-btn" id="expand-${index}">
                    <svg class="expand-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
            </div>
            <div class="history-details" id="details-${index}" style="display: none;">
                <div class="history-questions-horizontal">
                ${quiz.questions
                  .map(
                    (q, qIndex) => `
                    <div class="history-question">
                    <p class="history-question-text"><strong>Q${
                      qIndex + 1
                    }:</strong> ${q.question}</p>
                    <div class="history-options">
                        ${q.options
                          .map(
                            (opt, oIndex) => `
                        <p class="${
                          oIndex === q.correctAnswer
                            ? "correct-answer"
                            : oIndex === q.userAnswer &&
                              q.userAnswer !== q.correctAnswer
                            ? "wrong-answer"
                            : ""
                        }">
                            ${String.fromCharCode(65 + oIndex)}. ${opt}
                            ${oIndex === q.correctAnswer ? "✓" : ""}
                            ${
                              oIndex === q.userAnswer &&
                              q.userAnswer !== q.correctAnswer
                                ? "✗"
                                : ""
                            }
                        </p>
                        `
                          )
                          .join("")}
                    </div>
                    </div>
                `
                  )
                  .join("")}
                </div>
            </div>
        </div>
        `;
    })
    .join("");
}

function toggleDetails(index) {
  const details = document.getElementById(`details-${index}`);
  const expandBtn = document.getElementById(`expand-${index}`);
  const historyItem = details.closest(".history-item");

  if (details.style.display === "none") {
    details.style.display = "block";
    expandBtn.classList.add("expanded");
    historyItem.classList.add("expanded");
  } else {
    details.style.display = "none";
    expandBtn.classList.remove("expanded");
    historyItem.classList.remove("expanded");
  }
}

function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00";
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDateTime(isoString) {
  const dateObj = new Date(isoString);
  const date = dateObj.toLocaleDateString("en-GB");
  const time = dateObj.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date, time };
}

function retryQuiz() {
  startQuiz();
}

function resetApp() {
  resultsScreen.classList.remove("active");
  welcomeScreen.classList.add("active");

  topicInputField.value = "";
  questionCountInput.value = "5";
  generateQuizBtn.disabled = false;
  topicInputSection.classList.add("hidden");

  userCards.forEach((card) => card.classList.remove("selected"));

  quizState = {
    userType: "",
    topic: "",
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    startTime: null,
    timerInterval: null,
    timeLimit: 0,
    questionCount: 5,
    userAnswers: [],
  };
}
