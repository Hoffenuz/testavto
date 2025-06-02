import { useState, useEffect } from 'react'
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
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [testType, setTestType] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    async function loadQuestions() {
      const { data, error } = await supabase.from('questions').select('*');
      if (error) {
        console.error('Savollarni olishda xatolik:', error);
        return;
      }
      let selected = [];
      if (data.length >= 20) {
        // Random 20 ta savol tanlash (takrorlanmas)
        const shuffled = data.sort(() => 0.5 - Math.random());
        selected = shuffled.slice(0, 20);
      } else {
        // Kamida 20 ta bo'lishi uchun takrorlash
        while (selected.length < 20) {
          const shuffled = data.sort(() => 0.5 - Math.random());
          for (let i = 0; i < shuffled.length && selected.length < 20; i++) {
            selected.push(shuffled[i]);
          }
        }
      }
      setQuestions(selected);
    }
    loadQuestions();
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

  const startTest = (type) => {
    setTestType(type);
    setIsStarted(true);
  };

  const handleAnswerSelect = async (questionId, choiceId) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId
    }));

    if (testType === 'practice') {
      const { data: choices } = await supabase
        .from('choices')
        .select('*')
        .eq('question_id', questionId);
      
      const selectedChoice = choices.find(choice => choice.id === choiceId);
      // Amaliyot rejimida har bir javobdan keyin natija ko'rsatiladi
      // Bu yerda kerakli logikani qo'shishingiz mumkin
    }
  };

  const finishTest = () => {
    const { correctAnswers } = calculateResults();
    const unansweredQuestions = questions.filter(q => !selectedAnswers[q.id]).length;
    
    if (unansweredQuestions > 0) {
      if (confirm(`${unansweredQuestions} ta savol javobsiz qolgan. Testni yakunlashni xohlaysizmi?`)) {
        setShowResults(true);
      }
    } else {
      setShowResults(true);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderChoices = async (questionId) => {
    const { data: choices, error } = await supabase
      .from('choices')
      .select('*')
      .eq('question_id', questionId);

    if (error) {
      console.error('Javoblarni olishda xatolik:', error);
      return [];
    }

    return choices;
  };

  useEffect(() => {
    if (questions[currentQuestionIndex]) {
      renderChoices(questions[currentQuestionIndex].id).then(choices => {
        setQuestions(prevQuestions => {
          const newQuestions = [...prevQuestions];
          newQuestions[currentQuestionIndex] = {
            ...newQuestions[currentQuestionIndex],
            choices
          };
          return newQuestions;
        });
      });
    }
  }, [currentQuestionIndex, questions[currentQuestionIndex]?.id]);

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
  return (
      <div className="question">
        <h3>Savol {currentQuestionIndex + 1}</h3>
        <p>{question.question_text}</p>
        <div className="question-image">
          {question.image_url ? (
            <img src={question.image_url} alt="Savol rasmi" />
          ) : (
            <img src={DEFAULT_QUESTION_IMAGE} alt="Default rasm" className="default-image" />
          )}
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
          <li>Savollar soni: 20 ta</li>
          <li>Vaqt: 25 daqiqa</li>
          <li>O'tish bali: 18 ta to'g'ri javob</li>
          <li>Har bir savol 1 balldan baholanadi</li>
        </ul>
      </div>
      <div className="test-type-buttons">
        <button 
          className="test-type-button"
          onClick={() => startTest('practice')}
        >
          <span>Amaliyot test</span>
        </button>
        <button 
          className="test-type-button"
          onClick={() => startTest('exam')}
        >
          <span>Yakuniy test</span>
        </button>
      </div>
    </div>
  );

  const renderResults = () => {
    const { correctAnswers, results } = calculateResults();
    const percentage = Math.round((correctAnswers / 20) * 100);
    const isPassed = correctAnswers >= 18;

    return (
      <div className="results-screen">
        <div className="results-header">
          <h2>Test Natijalari</h2>
          <div 
            className="results-progress" 
            style={{ "--progress": percentage }}
          >
            <div className="progress-circle">
              <div className="progress-value">{percentage}%</div>
            </div>
          </div>
        </div>

        <div className="results-stats">
          <div className="stat-card">
            <div className="stat-value">{correctAnswers}</div>
            <div className="stat-label">To'g'ri javoblar</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{20 - correctAnswers}</div>
            <div className="stat-label">Noto'g'ri javoblar</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{isPassed ? 'Otdi' : 'Otmadi'}</div>
            <div className="stat-label">Natija</div>
          </div>
        </div>

        <div className="results-details">
          <h3>Batafsil natijalar:</h3>
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-number">{index + 1}</div>
                <div className="result-question">{result.question}</div>
                <div className={`result-status ${result.isCorrect ? 'status-correct' : 'status-incorrect'}`}>
                  {result.isCorrect ? (
                    <>✓ To'g'ri</>
                  ) : (
                    <>✗ Noto'g'ri</>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="results-buttons">
          <button 
            className="result-button back-button"
            onClick={() => setShowResults(false)}
          >
            Testga qaytish
          </button>
          <button 
            className="result-button restart-button"
            onClick={() => window.location.reload()}
          >
            Qayta boshlash
          </button>
        </div>
      </div>
    );
  };

  if (!isStarted) {
    return renderWelcomeScreen();
  }

  if (showResults) {
    return renderResults();
  }

  return (
    <div className="container">
      {!isStarted ? (
        renderWelcomeScreen()
      ) : showResults ? (
        renderResults()
      ) : (
        <>
          <div className="main-container">
            <div className="main-content">
              <div className="question-navigation">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    className={`question-number ${
                      selectedAnswers[questions[index]?.id] ? 'answered' : ''
                    } ${index === currentQuestionIndex ? 'current' : ''}`}
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="question-container">
                {questions[currentQuestionIndex] && (
                  <>
                    <div className="question">
                      <h3>Savol {currentQuestionIndex + 1}</h3>
                      <p>{questions[currentQuestionIndex].question_text}</p>
                    </div>

                    <div className="choices">
                      {questions[currentQuestionIndex].choices?.map((choice) => (
                        <button
                          key={choice.id}
                          className={`choice ${
                            selectedAnswers[questions[currentQuestionIndex].id] === choice.id
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() => handleAnswerSelect(
                            questions[currentQuestionIndex].id,
                            choice.id
                          )}
                        >
                          {choice.choice_text}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="image-section">
            <div className="image-container">
              {questions[currentQuestionIndex]?.image_url ? (
                <img 
                  src={questions[currentQuestionIndex].image_url}
                  alt="Savol rasmi"
                  className="question-image"
                />
              ) : (
                <div className="image-placeholder">
                  Rasm mavjud emas
                </div>
              )}
            </div>
          </div>

          <div className="header-controls">
            <div className="timer">Qolgan vaqt: {formatTime(timeLeft)}</div>
            <button className="exit-button" onClick={() => setShowExitConfirm(true)}>
              Chiqish
            </button>
          </div>

          <div className="footer">
            <button className="finish-button" onClick={finishTest}>
              Testni yakunlash
            </button>
          </div>
        </>
      )}
      
      {showExitConfirm && (
        <div className="modal">
          <div className="modal-content">
            <h3>Testdan chiqishni xohlaysizmi?</h3>
            <div className="modal-buttons">
              <button onClick={() => window.location.reload()}>Ha</button>
              <button onClick={() => setShowExitConfirm(false)}>Yo'q</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
