import React, { useState, useRef, useEffect, useCallback } from 'react';
import './chatbot.css';
import api from '../../services/api';

const MAX_SESSIONS = 20;
const MAX_BORROW_LIMIT = 3;

const Chatbot = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedReply, setTypedReply] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [borrowedCount, setBorrowedCount] = useState(0);
  const [isBorrowing, setIsBorrowing] = useState(false);

  const chatStreamRef = useRef(null);

  let parsedUser = null;
  try {
    parsedUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    parsedUser = null;
  }
  const storageKey = parsedUser
    ? `libraryChatSessions_${parsedUser.username || parsedUser.id}`
    : 'libraryChatSessions_guest';

  const ts = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isBorrowSuccessReply = (text = '') => {
    const t = text.toLowerCase();
    return t.includes('successfully borrowed') || t.includes('added to your borrowed books');
  };

  const isBorrowLimitReply = (text = '') => {
    const t = text.toLowerCase();
    return (
      t.includes('maximum allowed limit of 3') ||
      t.includes('maximum limit of 3') ||
      t.includes('borrow_limit') ||
      t.includes('please return one before borrowing more')
    );
  };

  const isAlreadyBorrowedReply = (text = '') => {
    const t = text.toLowerCase();
    return (
      t.includes('you already borrowed') ||
      t.includes('you already have "') ||
      t.includes('in your borrowed books') ||
      t.includes('already borrowed this book')
    );
  };

  const updateSelectedBookFromPayload = useCallback((payload) => {
    if (!payload?.book_suggested) return;
    setSelectedBook(prev => ({
      ...(prev || {}),
      ...payload.book_suggested,
    }));
  }, []);

  const addAiMsg = useCallback((text, bookSuggested = null) => {
    setSessions(prev => prev.map(s =>
      s.id !== activeSessionId ? s : {
        ...s,
        messages: [
          ...s.messages,
          { id: Date.now(), text, sender: 'ai', timestamp: ts(), bookSuggested }
        ]
      }
    ));
  }, [activeSessionId]);

  const createNewSession = useCallback(() => {
    const id = Date.now().toString();
    const ses = {
      id,
      title: 'New Chat',
      created: new Date().toISOString(),
      messages: [{
        id: 1,
        text: 'Welcome to LIBR-A.I-RY by GENG! I can help you find books, research topics, or answer questions about our collection.',
        sender: 'ai',
        timestamp: ts(),
        bookSuggested: null,
      }],
    };
    setSessions(prev => [ses, ...prev.slice(0, MAX_SESSIONS - 1)]);
    setActiveSessionId(id);
    setShowHistory(false);
    setInputValue('');
    setSelectedBook(null);
    setBorrowedCount(0);
  }, []);

  useEffect(() => {
    let list = [];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      list = Array.isArray(saved) ? saved.slice(0, MAX_SESSIONS) : [];
    } catch {
      list = [];
    }
    if (list.length > 0) {
      setSessions(list);
      setActiveSessionId(list[0].id);
    } else {
      createNewSession();
    }
  }, [storageKey, createNewSession]);

  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem(storageKey, JSON.stringify(sessions));
    else localStorage.removeItem(storageKey);
  }, [sessions, storageKey]);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, typedReply]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeMessages = activeSession?.messages || [];

  useEffect(() => {
    const borrowedNow = activeMessages.filter(msg => {
      if (msg.sender !== 'ai') return false;
      return isBorrowSuccessReply(msg.text);
    }).length;

    setBorrowedCount(Math.min(borrowedNow, MAX_BORROW_LIMIT));

    const latestBookMsg = [...activeMessages]
      .reverse()
      .find(msg => msg.sender === 'ai' && msg.bookSuggested);

    setSelectedBook(latestBookMsg?.bookSuggested || null);
  }, [activeMessages]);

  const selectSession = useCallback((id) => {
    setActiveSessionId(id);
    setShowHistory(false);
    setInputValue('');
  }, []);

  const updateTitle = useCallback((id, text) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title: text.slice(0, 50) + (text.length > 50 ? '...' : '') } : s
    ));
  }, []);

  const clearCurrentChat = useCallback(() => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s =>
      s.id !== activeSessionId ? s : {
        ...s,
        messages: [{
          id: 1,
          text: 'Chat cleared. How can I help you today?',
          sender: 'ai',
          timestamp: ts(),
          bookSuggested: null
        }]
      }
    ));
    setSelectedBook(null);
    setBorrowedCount(0);
  }, [activeSessionId]);

  const deleteCurrentChat = useCallback(() => {
    if (!activeSessionId) return;
    const rest = sessions.filter(s => s.id !== activeSessionId);
    if (rest.length === 0) {
      // Never leave the user with zero chats (the input would stay disabled).
      setSessions([]);
      createNewSession();
      return;
    }
    setSessions(rest);
    setActiveSessionId(rest[0].id);
    setShowHistory(false);
    setInputValue('');
    setSelectedBook(null);
    setBorrowedCount(0);
  }, [activeSessionId, sessions, createNewSession]);

  const appendUserMessage = (text) => {
    const userMsgId = Date.now();
    setSessions(prev => prev.map(s =>
      s.id !== activeSessionId ? s : {
        ...s,
        messages: [...s.messages, {
          id: userMsgId,
          text,
          sender: 'user',
          timestamp: ts(),
          bookSuggested: null
        }]
      }
    ));
    return userMsgId;
  };

  const appendAiTypingMessage = (aiMsgId, replyTs, bookSuggested) => {
    setSessions(prev => prev.map(s =>
      s.id !== activeSessionId ? s : {
        ...s,
        messages: [...s.messages, {
          id: aiMsgId,
          text: '',
          sender: 'ai',
          timestamp: replyTs,
          bookSuggested: bookSuggested || null
        }]
      }
    ));
  };

  const animateAiReply = (fullReply, aiMsgId) => {
    setIsTyping(true);
    setTypedReply('');
    let idx = 0;

    const interval = setInterval(() => {
      idx += 1;
      const cur = fullReply.slice(0, idx);
      setTypedReply(cur);

      setSessions(prev => prev.map(s =>
        s.id !== activeSessionId ? s : {
          ...s,
          messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: cur } : m)
        }
      ));

      if (idx >= fullReply.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 5);
  };

  const sendChatRequest = async (text, historyOverride = null) => {
    const history = historyOverride || activeMessages
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
      .concat({ role: 'user', content: text });

    const res = await api.post('/chatbot/chat/', { message: text, history }, { withCredentials: true });
    return res.data || {};
  };

  const handleBorrowBook = async (bookInfo) => {
    if (!bookInfo?.id || !activeSessionId || isLoading || isBorrowing) return;

    setIsBorrowing(true);
    setIsLoading(true);
    setSelectedBook(bookInfo);

    try {
      await api.post(
        '/reservations/reserve/',
        { book_id: bookInfo.id },
        { withCredentials: true }
      );

      const successText = `"${bookInfo.title}" was successfully borrowed and has been added to your borrowed books.`;

      const updatedBook = {
        ...bookInfo,
        borrowed: true,
        is_available: false,
        available_copies:
          typeof bookInfo.available_copies === 'number'
            ? Math.max(bookInfo.available_copies - 1, 0)
            : bookInfo.available_copies,
      };

      addAiMsg(successText, updatedBook);
      setBorrowedCount(prev => Math.min(prev + 1, MAX_BORROW_LIMIT));
      setSelectedBook(updatedBook);
    } catch (err) {
      console.error('Borrow error:', err?.response?.data || err);

      const apiError = err?.response?.data;
      let errorText = `❌ Failed to borrow "${bookInfo.title}". Please try again.`;

      if (apiError?.error === 'borrow_limit') {
        errorText = apiError?.message || 'You have reached the maximum allowed limit of 3 borrowed books.';
      } else if (typeof apiError?.error === 'string') {
        errorText = apiError.error;
      } else if (typeof apiError?.message === 'string') {
        errorText = apiError.message;
      } else if (typeof apiError?.detail === 'string') {
        errorText = apiError.detail;
      }

      addAiMsg(errorText, {
        ...bookInfo,
        borrowed: false,
      });
    } finally {
      setIsLoading(false);
      setIsBorrowing(false);
    }
  };

  const handleSuggestMore = async (context, bookInfo) => {
    if (!activeSessionId || !bookInfo?.id) return;
    setIsLoading(true);
    try {
      const res = await api.get('/chatbot/related-books/', {
        params: { book_id: bookInfo.id },
        withCredentials: true,
      });
      const related = res.data.related || [];
      const text = related.length === 0
        ? "I couldn't find other closely related books in the catalog, but you might enjoy browsing similar genres."
        : 'Here are some related books from the library:\n' +
          related.map((b, i) => `${i + 1}. "${b.title}" by ${b.author}`).join('\n');
      addAiMsg(text);
    } catch (err) {
      console.error(err);
      addAiMsg('Failed to find more related books. Try again later!');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading || !activeSessionId) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    const currentMessages = currentSession?.messages || [];

    const history = currentMessages
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))
      .concat({ role: 'user', content: text });

    const userMsgId = appendUserMessage(text);

    if (currentSession?.messages.length === 1 && currentSession.messages[0].sender === 'ai') {
      updateTitle(activeSessionId, text);
    }

    setInputValue('');
    setIsLoading(true);

    try {
      const data = await sendChatRequest(text, history);
      const fullReply = data.reply || 'Sorry, I could not generate a response.';
      const aiMsgId = userMsgId + 1;
      const replyTs = ts();

      appendAiTypingMessage(aiMsgId, replyTs, data.book_suggested || null);
      updateSelectedBookFromPayload(data);

      if (isBorrowSuccessReply(fullReply)) {
        setBorrowedCount(prev => Math.min(prev + 1, MAX_BORROW_LIMIT));
        if (data.book_suggested) {
          setSelectedBook(prev => ({
            ...(prev || {}),
            ...data.book_suggested,
            borrowed: true,
            is_available: false,
          }));
        }
      } else if (isAlreadyBorrowedReply(fullReply)) {
        if (data.book_suggested) {
          setSelectedBook(prev => ({
            ...(prev || {}),
            ...data.book_suggested,
            borrowed: true,
          }));
        }
      } else if (isBorrowLimitReply(fullReply)) {
        // no-op
      }

      animateAiReply(fullReply, aiMsgId);
    } catch (err) {
      console.error(err);
      addAiMsg('Error contacting AI service. Please try again.');
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const canBorrowBook = (bookInfo) => {
    if (!bookInfo) return false;
    if (isLoading || isBorrowing) return false;
    if (bookInfo.borrowed) return false;
    if (borrowedCount >= MAX_BORROW_LIMIT) return false;
    if (bookInfo.is_available === false) return false;
    if (typeof bookInfo.available_copies === 'number' && bookInfo.available_copies <= 0) return false;
    return true;
  };

  const getBorrowButtonLabel = (bookInfo) => {
    if (isBorrowing) return 'Borrowing...';
    if (bookInfo?.borrowed) return 'Already Borrowed';
    if (borrowedCount >= MAX_BORROW_LIMIT) return 'Borrow Limit Reached';
    if (bookInfo?.is_available === false) return 'Unavailable';
    if (typeof bookInfo?.available_copies === 'number' && bookInfo.available_copies <= 0) return 'Unavailable';
    return '📖 Borrow';
  };

  return (
    <div className="book-chat-wrapper">
      <div className="book-spine">
        <div className="spine-title">LIBR-A.I-RY</div>
        <div className="spine-actions">
          <button className="spine-btn" onClick={() => setShowHistory(v => !v)} title="History">
            {showHistory ? '✕' : '☰'}
          </button>
          <button className="spine-btn" onClick={deleteCurrentChat} title="Delete">🗑️</button>
          <button className="spine-btn" onClick={clearCurrentChat} title="Clear">🧹</button>
          <button className="spine-btn" onClick={createNewSession} title="New chat">➕</button>
        </div>
      </div>

      <div className="book-main">
        <div className="book-header">
          <span className="book-header-title">✦ LIBR-A.I-RY by GENG</span>
          <span className="book-header-session">
            {activeSession?.messages?.length <= 1 ? 'New Chat' : activeSession?.title || 'New Chat'}
          </span>
        </div>

        {showHistory && (
          <div className="chat-history-dropdown">
            <div className="history-list">
              {sessions.slice(0, 10).map(session => (
                <div
                  key={session.id}
                  className={`history-item ${session.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => selectSession(session.id)}
                >
                  <div className="history-title">{session.title}</div>
                  <div className="history-preview">
                    {session.messages[session.messages.length - 1]?.text.slice(0, 40)}...
                  </div>
                  <div className="history-time">{new Date(session.created).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chat-stream" ref={chatStreamRef}>
          <div className="chat-stream-inner">
            {activeMessages.map((msg, idx) => {
              const isAi = msg.sender === 'ai';
              const isBook = isAi && !!msg.bookSuggested;
              const prevMsg = activeMessages[idx - 1];
              const senderChanged = prevMsg && prevMsg.sender !== msg.sender;

              const effectiveBook = isBook
                ? {
                    ...msg.bookSuggested,
                    ...(selectedBook && msg.bookSuggested?.id === selectedBook?.id ? selectedBook : {}),
                  }
                : null;

              const showBookUi = isBook && effectiveBook && !effectiveBook.borrowed;

              return (
                <div
                  key={msg.id}
                  className={`chat-row ${isAi ? 'row-ai' : 'row-user'} ${senderChanged ? 'sender-gap' : 'same-gap'}`}
                >
                  <div className={`bubble ${isAi ? 'bubble-ai' : 'bubble-user'}`}>
                    <div className="msg-text">{msg.text}</div>
                    <div className="msg-time">{msg.timestamp}</div>

                    {showBookUi && effectiveBook?.cover_url && (
                      <div className="book-cover-wrap">
                        <img
                          src={effectiveBook.cover_url}
                          alt={effectiveBook.title}
                          className="book-cover-img"
                        />
                      </div>
                    )}

                    {showBookUi && (
                      <div className="book-actions">
                        <button
                          className="borrow-btn"
                          onClick={() => handleBorrowBook(effectiveBook)}
                          disabled={!canBorrowBook(effectiveBook)}
                        >
                          {getBorrowButtonLabel(effectiveBook)}
                        </button>
                        <button
                          className="suggest-btn"
                          onClick={() => handleSuggestMore(msg.text, effectiveBook)}
                          disabled={isLoading || isBorrowing}
                        >
                          Suggest More
                        </button>
                      </div>
                    )}

                    {isBook && effectiveBook?.borrowed && (
                      <div className="borrowed-status">✅ Added to your borrowed books</div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && !isTyping && (
              <div className="chat-row row-ai same-gap">
                <div className="bubble bubble-ai">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="input-row">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask for book recommendations, summaries, or author info..."
            rows={1}
            className="msg-input"
            disabled={!activeSessionId}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim() || !activeSessionId}
            className="send-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;