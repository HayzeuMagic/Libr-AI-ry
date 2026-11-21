import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import './BookSearch.css';

const PAGE_SIZE = 6;

/* ─── helpers ─────────────────────────────── */
const getAvailableCopies = (book) => {
  const copies =
    book.available_copies ??
    book.copies_available ??
    book.available_count ??
    book.availableCopies ??
    book.stock ??
    book.quantity_available ??
    book.quantity ??
    1;
  return Number(copies) || 0;
};

const getTotalCopies = (book) => {
  const total =
    book.total_copies ??
    book.totalCopies ??
    book.copies ??
    book.total_count ??
    book.stock ??
    getAvailableCopies(book);
  return Number(total) || getAvailableCopies(book);
};

const getBookStatus = (book) => {
  const availableCopies = getAvailableCopies(book);
  const totalCopies = getTotalCopies(book);

  if (availableCopies <= 0) {
    return { label: 'Not Available', className: 'not-available', availableCopies, totalCopies, canReserve: false };
  }
  if (availableCopies <= 2) {
    return { label: 'Few Books Available', className: 'few-available', availableCopies, totalCopies, canReserve: true };
  }
  return { label: 'Available', className: 'available', availableCopies, totalCopies, canReserve: true };
};

const hasBorrowedBook = (book, borrowedBooks, currentUserId) =>
  borrowedBooks.some(
    (b) =>
      (b.book_id === book.id || b.book === book.id || b.book?.id === book.id) &&
      (currentUserId == null ||
        b.user_id === currentUserId ||
        b.user === currentUserId ||
        b.user?.id === currentUserId) &&
      !b.return_date
  );

const looksLikeISBN = (str) => /^[\d\-]{9,17}$/.test(str.trim());

const buildQueryString = (query, category, ebookOnly) => {
  const q = query.trim();
  const params = new URLSearchParams();

  if (category === 'isbn') {
    params.set('isbn', q.replace(/-/g, '').replace(/\s/g, ''));
  } else if (category !== 'all') {
    params.set('q', q);
    params.set('category', category);
  } else {
    if (looksLikeISBN(q)) {
      params.set('isbn', q.replace(/-/g, '').replace(/\s/g, ''));
    } else {
      params.set('q', q);
    }
  }

  if (ebookOnly) params.set('ebook', 'true');
  return params.toString();
};

const CATEGORIES = [
  { value: 'all',    label: 'All'    },
  { value: 'title',  label: 'Title'  },
  { value: 'author', label: 'Author' },
  { value: 'isbn',   label: 'ISBN'   },
  { value: 'genre',  label: 'Genre'  },
];

/* ─── FIX 1: CenterModal moved OUTSIDE BookSearch ────────────────────────
   Defining a component inside another component causes React to treat it
   as a brand-new component type on every parent render, forcing a full
   unmount + remount on every state change (flicker, lost focus, etc.).   */
const CenterModal = ({ message, onClose }) =>
  !message ? null : (
    <div className="modal-backdrop">
      <div className="modal-box">
        <p>{message}</p>
        <button className="reserve-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  );

/* ─── FIX 2: Safe localStorage parser extracted as a pure utility ─────── */
const safeParsedUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/* ─── COMPONENT ───────────────────────────── */
const BookSearch = () => {
  const [query, setQuery]               = useState('');
  const [category, setCategory]         = useState('all');
  const [ebookOnly, setEbookOnly]       = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [page, setPage]                 = useState(1);
  const [modalMessage, setModalMessage] = useState('');
  const [borrowLimitMessage, setBorrowLimitMessage] = useState('');
  const [hasSearched, setHasSearched]   = useState(false);
  const [borrowedBooks, setBorrowedBooks] = useState([]);

  /* autocomplete */
  const [suggestions, setSuggestions]       = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestDebounce = useRef(null);
  const wrapperRef = useRef(null);

  /* ─── FIX 2 applied: safe parse, try/catch, correct key ──────────────
     Uses the same safeParsedUser() utility so a corrupted 'user' value
     in localStorage will never crash the component on mount.            */
  const parsedUser    = safeParsedUser();
  const currentUserId = parsedUser?.id ?? parsedUser?.user_id ?? null;
  const isAdmin =
    localStorage.getItem('isAdmin') === 'true' || parsedUser?.is_staff === true;

  /* admin edit */
  const [editingBook, setEditingBook] = useState(null);
  const [editForm, setEditForm]       = useState({ title: '', author: '', isbn: '', genre: '', cover_url: '' });
  const [savingEdit, setSavingEdit]   = useState(false);

  /* ── load borrowed books ── */
  const loadBorrowedBooks = useCallback(async () => {
    if (isAdmin) { setBorrowedBooks([]); return; }
    try {
      // /reservations/history/ returns this user's active (borrowed/overdue) loans.
      const res  = await api.get('/reservations/history/');
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setBorrowedBooks(
        data.map((r) => ({ book_id: r.book, user_id: currentUserId, return_date: r.return_date }))
      );
    } catch (error) {
      console.error('Failed to load borrowed books:', error);
      setBorrowedBooks([]);
    }
  }, [isAdmin, currentUserId]);

  useEffect(() => { loadBorrowedBooks(); }, [loadBorrowedBooks]);

  /* ── close suggestions on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ─── FIX 3: clear debounce timeout on unmount ────────────────────────
     Without this, the timeout fires after the component unmounts and
     tries to call setState on an unmounted component (memory leak +
     React warning in dev mode).                                          */
  useEffect(() => {
    return () => clearTimeout(suggestDebounce.current);
  }, []);

  /* ── debounced autocomplete fetch ── */
  const fetchSuggestions = useCallback(async (value) => {
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const qs  = buildQueryString(value, category, false);
      const res = await api.get(`/books/search/?${qs}&limit=6`);
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];

      const labels = data
        .map((b) => {
          if (category === 'isbn')   return b.isbn   ? String(b.isbn)  : null;
          if (category === 'author') return b.author ?? null;
          if (category === 'genre')  return b.genre  ?? null;
          return b.title ?? null;
        })
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 6);

      setSuggestions(labels);
      setShowSuggestions(labels.length > 0);
      setActiveSuggestion(-1);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [category]);

  /* ── input change ── */
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(suggestDebounce.current);
    suggestDebounce.current = setTimeout(() => fetchSuggestions(val), 280);
  };

  /* ── main search ── */
  const handleSearch = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;

    setShowSuggestions(false);
    setIsLoading(true);
    setHasSearched(true);

    try {
      const qs  = buildQueryString(q, category, ebookOnly);
      const res = await api.get(`/books/search/?${qs}`);
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setSearchResults(data);
      setPage(1);
    } catch (error) {
      console.error('Search failed:', error);
      setModalMessage('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [query, category, ebookOnly]);

  /* ─── FIX 4: pickSuggestion wrapped in useCallback ───────────────────
     Previously not memoized while fetchSuggestions was, causing
     unnecessary re-renders. Also replaced alert() with modal.          */
  const pickSuggestion = useCallback((val) => {
    setQuery(val);
    setShowSuggestions(false);
    handleSearch(val);
  }, [handleSearch]);

  /* ── keyboard nav in suggestions ── */
  const handleKeyDown = (e) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') handleSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion((p) => Math.max(p - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0) pickSuggestion(suggestions[activeSuggestion]);
      else handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  /* ── reserve ── */
  const handleReserve = async (book) => {
    const bookStatus    = getBookStatus(book);
    const alreadyBorrowed = hasBorrowedBook(book, borrowedBooks, currentUserId);

    if (alreadyBorrowed) { setModalMessage('This book is already in your borrowed books.'); return; }
    if (!bookStatus.canReserve) { setModalMessage('This book is currently not available.'); return; }

    try {
      await api.post('/reservations/reserve/', { book_id: book.id });

      setSearchResults((prev) =>
        prev.map((item) => {
          if (item.id !== book.id) return item;
          const updated = Math.max(getAvailableCopies(item) - 1, 0);
          return { ...item, available_copies: updated, copies_available: updated, available_count: updated, stock: updated };
        })
      );

      setBorrowedBooks((prev) => [...prev, { book_id: book.id, user_id: currentUserId, return_date: null }]);
      setModalMessage('Book reserved successfully!');
    } catch (error) {
      const errorCode    = error.response?.data?.error;
      const errorMessage = error.response?.data?.message;

      if (errorCode === 'borrow_limit') {
        setBorrowLimitMessage(errorMessage);
      } else {
        setModalMessage(
          errorMessage ||
          error.response?.data?.detail ||
          error.response?.data?.error ||
          'This book is already reserved'
        );
      }
    }
  };

  /* ── e-books go to the reader collection, not a physical loan ── */
  const handleAddEbook = async (book) => {
    try {
      const res = await api.post('/books/add-to-collection/', { book_id: book.id });
      setModalMessage(res.data?.message || 'E-book added to your collection.');
    } catch (error) {
      setModalMessage(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Could not add this e-book to your collection.'
      );
    }
  };

  /* ── clear ── */
  const handleClear = () => {
    setQuery('');
    setSearchResults([]);
    setPage(1);
    setHasSearched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setCategory('all');
    setEbookOnly(false);
  };

  /* ── admin edit ── */
  const handleEdit = (book) => {
    setEditingBook(book);
    setEditForm({
      title:     book.title     || '',
      author:    book.author    || '',
      isbn:      book.isbn      || '',
      genre:     book.genre     || '',
      cover_url: book.cover_url || '',
    });
  };

  const closeEditModal  = () => { setEditingBook(null); setSavingEdit(false); };
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingBook) return;
    setSavingEdit(true);
    try {
      const res = await api.put(`/books/${editingBook.id}/`, editForm);
      setSearchResults((prev) => prev.map((b) => (b.id === res.data.id ? res.data : b)));
      setModalMessage('Book updated successfully.');
      closeEditModal();
    } catch {
      setModalMessage('Failed to update book. Please try again.');
      setSavingEdit(false);
    }
  };

  /* ── pagination ── */
  const totalPages     = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const visibleResults = searchResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ─── FIX 5: safe published year ─────────────────────────────────────
     new Date('bad-string').getFullYear() returns NaN which renders as
     the string "NaN" in the DOM. Guard with isNaN check.               */
  const getPublishedYear = (dateStr) => {
    if (!dateStr) return null;
    const year = new Date(dateStr).getFullYear();
    return isNaN(year) ? null : year;
  };

  /* ── render ── */
  return (
    <div className="book-search-container">
      <div className="book-search-header">
        <h1>Book Discovery</h1>
        <p>Find your next favorite book from our collection</p>
      </div>

      <div className="search-section">
        <div className="search-filters-row">
          <div className="category-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                className={`category-tab${category === cat.value ? ' active' : ''}`}
                onClick={() => { setCategory(cat.value); setSuggestions([]); setShowSuggestions(false); }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <button
            className={`ebook-toggle${ebookOnly ? ' active' : ''}`}
            onClick={() => setEbookOnly((v) => !v)}
            title="Show only e-books"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            E-books
          </button>
        </div>

        <div className="search-input-wrapper" ref={wrapperRef}>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={
              category === 'isbn'   ? 'Enter exact ISBN number...'          :
              category === 'author' ? 'Search by author name...'            :
              category === 'genre'  ? 'Search by genre...'                  :
              category === 'title'  ? 'Search by book title...'             :
                                      'Search by title, author, ISBN, or genre...'
            }
            autoComplete="off"
          />
          <div className="input-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestions-list" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  role="option"
                  aria-selected={activeSuggestion === i}
                  className={`suggestion-item${activeSuggestion === i ? ' active' : ''}`}
                  onMouseDown={() => pickSuggestion(s)}
                >
                  <svg className="suggestion-icon" xmlns="http://www.w3.org/2000/svg"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {s.toLowerCase().startsWith(query.toLowerCase()) ? (
                    <><strong>{s.slice(0, query.length)}</strong>{s.slice(query.length)}</>
                  ) : s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="search-buttons">
          <button onClick={() => handleSearch()} disabled={isLoading} className="search-btn">
            {isLoading ? (<><span className="spinner"></span>Searching...</>) : 'Search'}
          </button>
          <button onClick={handleClear} className="clear-btn">Clear</button>
        </div>
      </div>

      <div className="results-section">
        {searchResults.length > 0 && (
          <h2 className="results-title">
            Found {searchResults.length} book{searchResults.length !== 1 ? 's' : ''}
          </h2>
        )}

        {searchResults.length > 0 ? (
          <>
            <div className="books-grid">
              {visibleResults.map((book) => {
                const bookStatus      = getBookStatus(book);
                const alreadyBorrowed = hasBorrowedBook(book, borrowedBooks, currentUserId);
                const disableReserve  = !bookStatus.canReserve || alreadyBorrowed;
                const publishedYear   = getPublishedYear(book.published_date); // FIX 5

                return (
                  <div key={book.id} className="book-card">
                    <div className="book-cover">
                      <img
                        src={book.cover_url || '/lib.png'}
                        alt={book.title}
                        loading="lazy"
                        onError={(e) => { e.target.src = '/lib.png'; }}
                      />
                    </div>

                    <div className="book-info">
                      <h3>{book.title}</h3>
                      <p className="author">{book.author}</p>

                      <div className="book-meta">
                        {book.isbn && <span className="isbn">ISBN: {book.isbn}</span>}
                        {publishedYear && <span className="published">{publishedYear}</span>}
                        {book.is_ebook && <span className="ebook-badge">E-Book</span>}
                      </div>

                      <div className={`book-status ${bookStatus.className}`}>
                        <span className="status-dot"></span>
                        <span>{bookStatus.label}</span>
                      </div>

                      <div className={`copy-count ${bookStatus.availableCopies <= 0 ? 'no-copies' : ''}`}>
                        {bookStatus.availableCopies <= 0
                          ? 'No copies available'
                          : `${bookStatus.availableCopies} of ${bookStatus.totalCopies} copies available`}
                      </div>

                      {!isAdmin && alreadyBorrowed && (
                        <div className="book-status few-available already-borrowed-badge">
                          <span className="status-dot"></span>
                          <span>Already in your borrowed books</span>
                        </div>
                      )}
                    </div>

                    {isAdmin ? (
                      <button onClick={() => handleEdit(book)} className="reserve-btn edit-btn">Edit</button>
                    ) : book.is_ebook ? (
                      <button onClick={() => handleAddEbook(book)} className="reserve-btn">
                        Add to My E-Books
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReserve(book)}
                        className={`reserve-btn ${disableReserve ? 'disabled-reserve-btn' : ''}`}
                        disabled={disableReserve}
                      >
                        {alreadyBorrowed ? 'Already Borrowed' : bookStatus.canReserve ? 'Reserve' : 'Not Available'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {searchResults.length > PAGE_SIZE && (
              <div className="ourbooks-pagination">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
              </div>
            )}
          </>
        ) : hasSearched ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3>No books found</h3>
            <p>Try a different search term or select a different category.</p>
          </div>
        ) : null}
      </div>

      <CenterModal message={modalMessage} onClose={() => setModalMessage('')} />

      {borrowLimitMessage && (
        <div className="borrow-limit-overlay" onClick={() => setBorrowLimitMessage('')}>
          <div className="borrow-limit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="borrow-limit-icon">📚</div>
            <h3>Borrow Limit Reached</h3>
            <p>{borrowLimitMessage}</p>
            <button onClick={() => setBorrowLimitMessage('')}>Got it</button>
          </div>
        </div>
      )}

      {isAdmin && editingBook && (
        <div className="edit-modal-backdrop">
          <div className="edit-modal">
            <h2>Edit Book</h2>
            <div className="edit-form">
              {['title', 'author', 'isbn', 'genre', 'cover_url'].map((field) => (
                <label key={field}>
                  {field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')}
                  <input name={field} value={editForm[field]} onChange={handleEditChange} />
                </label>
              ))}
            </div>
            <div className="edit-modal-actions">
              <button className="clear-btn"  onClick={closeEditModal}  disabled={savingEdit}>Cancel</button>
              <button className="search-btn" onClick={handleSaveEdit}  disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookSearch;