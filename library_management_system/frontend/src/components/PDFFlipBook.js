import React, { forwardRef, useMemo, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Document, Page, pdfjs } from 'react-pdf';
import './PDFFlipBook.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const BookPage = forwardRef(({ pageNumber, pageWidth }, ref) => {
  return (
    <div
      className={`book-page ${pageNumber % 2 === 0 ? 'book-page-right' : 'book-page-left'}`}
      ref={ref}
    >
      <div className="book-page-inner">
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={<div className="ebooks-state">Loading page...</div>}
          error={<div className="ebooks-state">Page failed to render.</div>}
          className="pdf-page-fit"
        />
        <span className="book-page-number">{pageNumber}</span>
      </div>
    </div>
  );
});

function PDFFlipBook({ fileData }) {
  const [numPages, setNumPages] = useState(0);

  const documentFile = useMemo(() => {
    if (!fileData) return null;
    return { data: fileData };
  }, [fileData]);

  const handleLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleLoadError = (error) => {
    console.error('React-PDF load error:', error);
  };

  const bookWidth = 560;
  const bookHeight = 800;
  const pdfPageWidth = 515;

  return (
    <div className="flipbook-shell">
      <Document
        file={documentFile}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={<p className="ebooks-state">Preparing flipbook...</p>}
        error={<p className="ebooks-state">Failed to load PDF pages.</p>}
      >
        {numPages > 0 && (
          <HTMLFlipBook
            key={`${bookWidth}-${bookHeight}-${numPages}`}
            width={bookWidth}
            height={bookHeight}
            minWidth={bookWidth}
            maxWidth={bookWidth}
            minHeight={bookHeight}
            maxHeight={bookHeight}
            size="fixed"
            drawShadow={true}
            maxShadowOpacity={0.22}
            showCover={true}
            usePortrait={false}
            mobileScrollSupport={true}
            className="home-style-flipbook"
            style={{ minHeight: 0 }}
          >
            {new Array(numPages).fill(0).map((_, index) => (
              <BookPage
                key={index + 1}
                pageNumber={index + 1}
                pageWidth={pdfPageWidth}
              />
            ))}
          </HTMLFlipBook>
        )}
      </Document>
    </div>
  );
}

export default PDFFlipBook;