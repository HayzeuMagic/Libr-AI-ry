import csv
import os
from books.models import Book

CSV_PATH = r'C:\Users\George\Desktop\GENG_LIB\library_management_system\database\books.csv'

print(f'Loading CSV...')

# Step 1: Read all stock values from CSV into a dict {isbn: stock}
stock_map = {}
skipped = 0

with open(CSV_PATH, encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    print(f'Columns: {reader.fieldnames}')
    for row in reader:
        raw = row.get('Stock') or row.get('stock') or '0'
        try:
            stock_val = int(str(raw).strip())
        except ValueError:
            skipped += 1
            continue
        isbn_val = str(row.get('isbn') or '').strip()
        if isbn_val:
            stock_map[isbn_val] = stock_val

print(f'CSV loaded: {len(stock_map)} books, {skipped} skipped')

# Step 2: Load all books from DB in one query
print('Loading books from DB...')
all_books = list(Book.objects.only('id', 'isbn', 'stock', 'available_count'))
print(f'DB loaded: {len(all_books)} books')

# Step 3: Update in memory
to_update = []
not_found = 0

for book in all_books:
    isbn = str(book.isbn).strip()
    if isbn in stock_map:
        book.stock = stock_map[isbn]
        book.available_count = stock_map[isbn]
        to_update.append(book)
    else:
        not_found += 1

print(f'Books to update: {len(to_update)}, Not in CSV: {not_found}')

# Step 4: Bulk update in batches of 5000
BATCH_SIZE = 5000
total_batches = (len(to_update) + BATCH_SIZE - 1) // BATCH_SIZE

for i in range(0, len(to_update), BATCH_SIZE):
    batch = to_update[i:i + BATCH_SIZE]
    Book.objects.bulk_update(batch, ['stock', 'available_count'])
    current_batch = (i // BATCH_SIZE) + 1
    print(f'Batch {current_batch}/{total_batches} done ({min(i + BATCH_SIZE, len(to_update))} / {len(to_update)})')

print(f'\nDone! Updated {len(to_update)} books')

# Verify
b = Book.objects.filter(isbn='1632153955').first()
if b:
    print(f'Black Science: stock={b.stock}, available_count={b.available_count}')