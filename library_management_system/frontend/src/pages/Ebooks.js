import React, { useEffect, useState } from 'react';
import api from '../services/api';
import PDFFlipBook from '../components/PDFFlipBook';
import './Ebooks.css';

function EBooks() {
  const [ebooks, setEbooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [removingBookId, setRemovingBookId] = useState(null);

  const fetchEBooks = async () => {
    try {
      const res = await api.get('/books/ebooks/');
      setEbooks(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch e-books:', error);
      setEbooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEBooks();
  }, []);

  const openBook = async (book) => {
    try {
      setViewerLoading(true);
      setSelectedBook(book);
      setPdfData(null);

      const response = await api.get(book.pdf_url, {
        responseType: 'arraybuffer',
      });

      const uint8Array = new Uint8Array(response.data);
      setPdfData(uint8Array);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      setPdfData(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const openPdfInNewTab = async (book) => {
    try {
      const response = await api.get(book.pdf_url, {
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(response.data);
      const newTab = window.open(blobUrl, '_blank', 'noopener,noreferrer');

      if (!newTab) {
        console.error('Popup blocked while opening PDF in new tab.');
      }

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      console.error('Failed to open PDF in new tab:', error);
    }
  };

  const removeFromCollection = async (book) => {
    const confirmed = window.confirm(`Remove "${book.title}" from your collection?`);
    if (!confirmed) return;

    try {
      setRemovingBookId(book.id);
      await api.delete(`/books/remove-from-collection/${book.id}/`);

      setEbooks((prev) => prev.filter((item) => item.id !== book.id));
    } catch (error) {
      console.error('Failed to remove e-book from collection:', error);
      alert(
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        'Failed to remove e-book from collection.'
      );
    } finally {
      setRemovingBookId(null);
    }
  };

  const closeViewer = () => {
    setPdfData(null);
    setSelectedBook(null);
  };

  return (
    <div className="ebooks-page">
      {!selectedBook && (
        <div className="ebooks-header">
          <div>
            <h1>My E-Books</h1>
            <p className="ebooks-subtitle">Open or manage the e-books in your collection.</p>
          </div>
        </div>
      )}

      {!selectedBook ? (
        <div className="ebooks-grid">
          {loading ? (
            <p className="ebooks-state">Loading e-books...</p>
          ) : ebooks.length === 0 ? (
            <p className="ebooks-state">No e-books in your collection yet.</p>
          ) : (
            ebooks.map((book) => (
              <div className="ebook-card" key={book.id}>
                <div className="ebook-cover">
                  <img
                    src={book.cover_url || '/pdf.png'}
                    alt={book.title}
                    onError={(e) => {
                      e.currentTarget.src = '/pdf.png';
                    }}
                  />
                </div>

                <div className="ebook-info">
                  <h3>{book.title}</h3>
                  <p>{book.author || 'Unknown author'}</p>

                  <div className="ebook-buttons">
                    <button onClick={() => openBook(book)} className="btn-open">
                      Open Flipbook
                    </button>
                    <button
                      onClick={() => removeFromCollection(book)}
                      className="btn-remove"
                      disabled={removingBookId === book.id}
                    >
                      {removingBookId === book.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="ebook-viewer-section">
          <div className="ebook-viewer-header">
            <div>
              <h2>{selectedBook.title}</h2>
              <p>{selectedBook.author || 'Unknown author'}</p>
            </div>

            <div className="viewer-actions">
              <button
                onClick={() => openPdfInNewTab(selectedBook)}
                className="btn-new-tab viewer-btn"
              >
                Open PDF in New Tab
              </button>
              <button onClick={closeViewer} className="btn-back viewer-btn">
                Back to E-Books
              </button>
            </div>
          </div>

          <div className="ebook-flip-container">
            {viewerLoading ? (
              <p className="ebooks-state">Loading PDF...</p>
            ) : pdfData ? (
              <PDFFlipBook fileData={pdfData} />
            ) : (
              <p className="ebooks-state">Failed to load PDF.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EBooks;