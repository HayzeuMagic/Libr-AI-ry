import React, { useState } from 'react';
import './Home.css';

const rulesPage1 = [
  'Use LIBR-AI-RY only for educational, research, and library-related purposes.',
  'Search, borrow, reserve, and return library materials responsibly.',
  'Borrowed books must be returned within 7 days from the borrowing date.',
  'Books returned after the 7-day period will incur a penalty or late fee.',
  'Users with unpaid penalties may be temporarily restricted from borrowing.',
  'Lost or damaged books must be reported immediately and may require payment.',
];

const rulesPage2 = [
  'The AI assistant may help with searching, summarizing, and recommending resources.',
  'Always verify AI-generated answers using trusted books, journals, or library sources.',
  'Do not use AI for cheating, plagiarism, harmful content, or false information.',
  'Respect copyright rules. Do not copy or distribute materials without permission.',
  'Always cite books, articles, journals, and AI-assisted information properly.',
  'Keep your account private. Do not share your login details with others.',
  'Report incorrect book details, AI errors, or system issues to the administrator.',
];

const TOTAL_SPREADS = 2;

const Home = () => {
  const [spread, setSpread]       = useState(1);
  const [animating, setAnimating] = useState(false);

  const canGoBack = spread > 1;
  const canGoNext = spread < TOTAL_SPREADS;

  const flipTo = (target) => {
    if (animating || target === spread || target < 1 || target > TOTAL_SPREADS) return;
    setAnimating(true);
    setTimeout(() => {
      setSpread(target);
      setAnimating(false);
    }, 425);
  };

  return (
    <div className="home-root">
      <div className="book-wrapper">
        <div className="book-scene">

          {/* Flip Me hint — only on spread 1, anchored to book bottom-right */}
          {spread === 1 && !animating && (
            <div className="flip-hint" onClick={() => flipTo(2)}>
              <svg className="flip-arrow" viewBox="0 0 80 80" fill="none">
                <path
                  d="M 72 12 C 60 14, 18 22, 10 62"
                  stroke="#c9aa71" strokeWidth="4" strokeLinecap="round"
                />
                <polygon points="4,54 8,70 20,60" fill="#c9aa71" />
              </svg>
              <span className="flip-label">Flip me!</span>
            </div>
          )}

          <div
            className={`cover${
              animating
                ? spread === 1
                  ? ' flipping-forward'
                  : ' flipping-back'
                : ''
            }`}
          >
            {/* ── LEFT HALF — click goes to previous spread ── */}
            <div
              className={`book__page book__page--left${
                canGoBack && !animating ? ' book__page--clickable book__page--clickable-left' : ''
              }`}
              onClick={() => canGoBack && !animating && flipTo(spread - 1)}
            >
              {spread === 1 ? (
                <img src="/reading.jpg" alt="Scholar reading" className="book__img" />
              ) : (
                <div className="page__content page__content--rules">
                  <h1 className="rules-page-title">Library Rules</h1>
                  <div className="rules-page-subtitle">Part 1 of 2</div>
                  <div className="rules-page-divider" />
                  <ul className="rules-page-list">
                    {rulesPage1.map((rule, i) => <li key={i}>{rule}</li>)}
                  </ul>
                  <div className="page__number">2</div>
                </div>
              )}

              {/* Left hover arrow — only shown when there's a previous page */}
              {canGoBack && !animating && (
                <div className="page-hover-arrow page-hover-arrow--left">‹</div>
              )}
            </div>

            {/* Spine crease */}
            <div className="book__spine" />

            {/* ── RIGHT HALF — click goes to next spread ── */}
            <div
              className={`book__page book__page--right${
                canGoNext && !animating ? ' book__page--clickable book__page--clickable-right' : ''
              }`}
              onClick={() => canGoNext && !animating && flipTo(spread + 1)}
            >
              {spread === 1 ? (
                <div className="page__content">
                  <h1 className="page__content-book-title">
                    Welcome to<br />LIBR-A.I-RY
                  </h1>
                  <h2 className="page__content-author">Library Management System</h2>
                  <p className="page__content-credits">
                    Research by
                    <span>Casimsiman</span>
                    <span>Llanes</span>
                    <span>Macapagal</span>
                  </p>
                  <p className="page__content-credits">
                    Section <span>C331_CS</span>
                  </p>
                  <div className="page__content-copyright">
                    <p>A.I Library System Management</p>
                  </div>
                </div>
              ) : (
                <div className="page__content page__content--rules">
                  <h1 className="rules-page-title">Library Rules</h1>
                  <div className="rules-page-subtitle">Part 2 of 2</div>
                  <div className="rules-page-divider" />
                  <ul className="rules-page-list">
                    {rulesPage2.map((rule, i) => <li key={i}>{rule}</li>)}
                  </ul>
                  <div className="rules-page-notice">
                    ⚠️ Late returns, damaged books, plagiarism, or misuse may result
                    in penalties or account restriction.
                  </div>
                  <div className="page__number">3</div>
                </div>
              )}

              {/* Right hover arrow — only shown when there's a next page */}
              {canGoNext && !animating && (
                <div className="page-hover-arrow page-hover-arrow--right">›</div>
              )}
            </div>

            {/* Flip animation overlay */}
            <div
              className={`flip-overlay${animating ? ' flip-overlay--active' : ''} ${
                spread === 1 ? 'flip-overlay--forward' : 'flip-overlay--back'
              }`}
            />
          </div>

          {/* Page dots — below the book, no buttons */}
          <div className="book-dots">
            {Array.from({ length: TOTAL_SPREADS }, (_, i) => (
              <span
                key={i}
                className={`book-dot${spread === i + 1 ? ' active' : ''}`}
                onClick={() => flipTo(i + 1)}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Home;