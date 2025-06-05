import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

// Supabase konfiguratsiyasi
const supabaseUrl = 'https://oietcsgsbklgqjatefxt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZXRjc2dzYmtsZ3FqYXRlZnh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTg5NTAsImV4cCI6MjA2NDI5NDk1MH0.I_1HUJSBjclNsNNI69yr133UD-VZZCdAoMpLCBQb_ns'
const supabase = createClient(supabaseUrl, supabaseKey)

// Default rasm URL-i
const DEFAULT_QUESTION_IMAGE = 'https://via.placeholder.com/400x300?text=Test+Savoli';

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [incorrectAnswers, setIncorrectAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [testType, setTestType] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('testState');
    if (savedState) {
      const state = JSON.parse(savedState);
      setIsStarted(state.isStarted);
      setQuestions(state.questions);
      setCurrentQuestionIndex(state.currentQuestionIndex);
      setSelectedAnswers(state.selectedAnswers);
      setTimeLeft(state.timeLeft);
      setTestType(state.testType);
      setShowResults(state.showResults);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (isStarted) {
      const state = {
        isStarted,
        questions,
        currentQuestionIndex,
        selectedAnswers,
        timeLeft,
        testType,
        showResults
      };
      localStorage.setItem('testState', JSON.stringify(state));
    }
  }, [isStarted, questions, currentQuestionIndex, selectedAnswers, timeLeft, testType, showResults]);

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      const { data: questionsData, error: qError } = await supabase.from('questions').select('*');
      if (qError) {
        console.error('Savollarni olishda xatolik:', qError);
        setLoading(false);
        return;
      }
      
      let selected = [];
      if (questionsData.length >= 20) {
        const shuffled = shuffleArray(questionsData);
        selected = shuffled.slice(0, 20);
      } else {
        while (selected.length < 20) {
          const shuffled = shuffleArray(questionsData);
          selected.push(...shuffled.slice(0, 20 - selected.length));
        }
      }

      const ids = selected.map(q => q.id);
      const { data: allChoices, error: cError } = await supabase
        .from('choices')
        .select('*')
        .in('question_id', ids);

      if (cError) {
        console.error('Javoblarni olishda xatolik:', cError);
        setLoading(false);
        return;
      }

      const questionsWithChoices = selected.map(q => ({
        ...q,
        choices: shuffleArray(allChoices.filter(c => c.question_id === q.id))
      }));

      setQuestions(questionsWithChoices);
      setLoading(false);
    }

    if (!questions.length) {
      loadQuestions();
    }
  }, []);

  useEffect(() => {
    let timer;
    if (isStarted && timeLeft > 0 && !showResults) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      finishTest();
    }
    return () => clearInterval(timer);
  }, [isStarted, timeLeft]);

  useEffect(() => {
    setTimeout(() => {
      const currentButton = document.querySelector(`.question-number:nth-child(${currentQuestionIndex + 1})`);
      if (currentButton) {
        const container = document.querySelector('.question-navigation');
        if (container) {
          const containerWidth = container.offsetWidth;
          const buttonWidth = currentButton.offsetWidth;
          const scrollLeft = currentButton.offsetLeft - (containerWidth / 2) + (buttonWidth / 2);
          container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      }
    }, 100);
  }, [currentQuestionIndex]);

  const startTest = (type) => {
    setTestType(type);
    setIsStarted(true);
    // Clear previous test state
    localStorage.removeItem('testState');
  };

  const handleAnswerSelect = (questionId, choiceId) => {
    const currentQuestion = questions[currentQuestionIndex];
    const selectedChoice = currentQuestion.choices.find(choice => choice.id === choiceId);
    const isCorrect = selectedChoice.is_correct;

    // Darhol javobni belgilash va rangini o'zgartirish
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId
    }));

    if (!isCorrect) {
      // Darhol noto'g'ri javobni belgilash
      setIncorrectAnswers((prev) => ({
        ...prev,
        [questionId]: true
      }));
      const totalIncorrect = Object.keys(incorrectAnswers).length + 1;
      setErrorMessage(`Xato javob! (${totalIncorrect} ta xato)`);
      setTimeout(() => setErrorMessage(''), 2000);
    }

    // Faqat keyingi savolga o'tish uchun kechikish
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      }
    }, 2000);
  };

  const finishTest = () => {
    const unansweredQuestions = questions.filter(q => !selectedAnswers[q.id]).length;
    
    if (unansweredQuestions > 0) {
      if (confirm(`${unansweredQuestions} ta savol javobsiz qolgan. Testni yakunlashni xohlaysizmi?`)) {
        setShowResults(true);
        localStorage.removeItem('testState');
      }
    } else {
      setShowResults(true);
      localStorage.removeItem('testState');
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const calculateResults = () => {
    let correctAnswers = 0;
    const results = [];

    questions.forEach((question, index) => {
      const selectedAnswer = selectedAnswers[question.id];
      const correctChoice = question.choices.find(choice => choice.is_correct);
      
      const isCorrect = selectedAnswer === correctChoice?.id;
      if (isCorrect) correctAnswers++;

      results.push({
        questionNumber: index + 1,
        question: question.question_text,
        isCorrect,
        selectedAnswer: question.choices.find(choice => choice.id === selectedAnswer)?.choice_text,
        correctAnswer: correctChoice?.choice_text
      });
    });

    return { correctAnswers, results };
  };

  const renderQuestion = (question) => {
    if (!question) return null;

    return (
      <div className="question">
        <h3>Savol {currentQuestionIndex + 1} / {questions.length}</h3>
        <p>{question.question_text}</p>
        {question.image_url && (
          <div className="question-image">
            <img 
              src={question.image_url} 
              alt="Savol rasmi"
              onError={(e) => {
                e.target.src = DEFAULT_QUESTION_IMAGE;
              }}
            />
          </div>
        )}
        <div className="choices">
          {question.choices?.map((choice) => {
            const isSelected = selectedAnswers[question.id] === choice.id;
            let className = 'choice';
            
            // Darhol to'g'ri yoki noto'g'ri javob rangini ko'rsatish
            if (isSelected) {
              className += choice.is_correct ? ' correct' : ' incorrect';
            }
            
            return (
              <button
                key={choice.id}
                className={className}
                onClick={() => !selectedAnswers[question.id] && handleAnswerSelect(question.id, choice.id)}
                disabled={selectedAnswers[question.id]}
              >
                {choice.choice_text}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWelcomeScreen = () => (
    <div className="welcome-screen">
      <h1>Avtomaktab Test</h1>
      <div className="test-info">
        <h2>Test ma'lumotlari:</h2>
        <ul>
          <li>20 ta savol</li>
          <li>25 daqiqa vaqt</li>
          <li>O'tish bali: 18 ta to'g'ri javob</li>
        </ul>
      </div>
      <div className="test-type-buttons">
        <button 
          className="test-type-button" 
          onClick={() => startTest('practice')}
        >
          Testni boshlash
        </button>
      </div>
    </div>
  );

  const renderTestScreen = () => (
    <>
      <div className="header-controls">
        <div className="timer">Vaqt: {formatTime(timeLeft)}</div>
        <button className="exit-button" onClick={() => setShowExitConfirm(true)}>
          Testdan chiqish
        </button>
      </div>
      <div className="question-navigation">
        {questions.map((_, index) => (
          <button
            key={index}
            className={`question-number ${
              selectedAnswers[questions[index]?.id] ? 'answered' : ''
            } ${incorrectAnswers[questions[index]?.id] ? 'incorrect' : ''} ${
              index === currentQuestionIndex ? 'current' : ''
            }`}
            onClick={() => setCurrentQuestionIndex(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="question-container">
        {renderQuestion(questions[currentQuestionIndex])}
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>
      <div className="finish-button-container">
        <button 
          className="finish-button"
          onClick={finishTest}
        >
          Testni yakunlash
        </button>
      </div>
    </>
  );

  const renderResults = () => {
    const { correctAnswers, results } = calculateResults();
    const percentage = Math.round((correctAnswers / questions.length) * 100);
    const isPassed = correctAnswers >= 18;

    return (
      <div className="results-screen">
        <div className="results-content">
          <div className="results-header">
            <h2>Test Natijalari</h2>
          </div>
          
          <div className="results-progress">
            <div 
              className="progress-circle"
              style={{ "--progress": `${percentage}%` }}
            >
              <div className="progress-inner">
                <div className="progress-value">{percentage}%</div>
                <div className="progress-label">{isPassed ? "O'tdi" : "O'tmadi"}</div>
              </div>
            </div>
          </div>

          <div className="results-stats">
            <div className="stat-card">
              <div className="stat-value">{correctAnswers}</div>
              <div className="stat-label">To'g'ri javoblar</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{questions.length - correctAnswers}</div>
              <div className="stat-label">Noto'g'ri javoblar</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{questions.length}</div>
              <div className="stat-label">Jami savollar</div>
            </div>
          </div>

          <div className="results-buttons">
            <button 
              className="result-button secondary"
              onClick={() => setShowResults(false)}
            >
              Testga qaytish
            </button>
            <button 
              className="result-button primary"
              onClick={() => {
                setIsStarted(false);
                setShowResults(false);
                setSelectedAnswers({});
                setIncorrectAnswers({});
                setTimeLeft(25 * 60);
                setCurrentQuestionIndex(0);
                localStorage.removeItem('testState');
              }}
            >
              Yangi test boshlash
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="container">
      {!isStarted ? (
        renderWelcomeScreen()
      ) : showResults ? (
        renderResults()
      ) : (
        renderTestScreen()
      )}

      {showExitConfirm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Testdan chiqishni xohlaysizmi?</h3>
            <p>Barcha javoblaringiz o'chiriladi.</p>
            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsStarted(false);
                  setShowExitConfirm(false);
                  setSelectedAnswers({});
                  setIncorrectAnswers({});
                  setTimeLeft(25 * 60);
                  setCurrentQuestionIndex(0);
                  localStorage.removeItem('testState');
                }}
              >
                Ha, chiqish
              </button>
              <button onClick={() => setShowExitConfirm(false)}>
                Yo'q, davom etish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
