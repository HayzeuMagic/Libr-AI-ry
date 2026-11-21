import csv
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from books.models import Book

DEFAULT_CSV = Path(settings.BASE_DIR).parent / 'database' / 'books.csv'
BATCH_SIZE = 2000


def normalize_isbn(raw):
    """
    The CSV was exported through a spreadsheet, which dropped leading zeros
    from numeric ISBN-10s (e.g. 0761183272 -> 761183272). Restore them.
    """
    isbn = (raw or '').strip().replace('-', '').replace(' ', '')
    if isbn.isdigit() and len(isbn) < 10:
        isbn = isbn.zfill(10)
    return isbn


def parse_stock(raw):
    try:
        return max(int(str(raw).strip()), 0)
    except (TypeError, ValueError):
        return 0


class Command(BaseCommand):
    help = 'Import (or refresh) books from database/books.csv into the books_book table.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            type=str,
            default=str(DEFAULT_CSV),
            help=f'Path to the CSV file (default: {DEFAULT_CSV})',
        )

    def handle(self, *args, **options):
        csv_path = Path(options['path'])
        if not csv_path.exists():
            raise CommandError(f'CSV file not found: {csv_path}')

        books = []
        skipped = 0
        seen = set()

        with csv_path.open(newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            # Accept any header capitalisation (the file mixes "Title" and "author").
            reader.fieldnames = [h.strip().lower() for h in reader.fieldnames]

            for row in reader:
                isbn = normalize_isbn(row.get('isbn'))
                title = (row.get('title') or '').strip()
                if not isbn or not title or isbn in seen:
                    skipped += 1
                    continue
                seen.add(isbn)

                stock = parse_stock(row.get('stock'))
                books.append(Book(
                    isbn=isbn[:32],
                    title=title[:512],
                    author=(row.get('author') or '').strip()[:512],
                    genre=(row.get('genre') or '').strip()[:100],
                    cover_url=(row.get('cover_url') or '').strip()[:200],
                    stock=stock,
                    available_count=stock,
                ))

        self.stdout.write(f'Parsed {len(books)} books ({skipped} rows skipped). Writing to database...')

        # Upsert on ISBN (the table's unique key). Existing rows keep their
        # available_count so that re-running the import never "returns" books
        # that are still borrowed. MySQL picks the conflicting unique key
        # itself, so `unique_fields` is only passed on other backends.
        upsert_kwargs = {
            'update_conflicts': True,
            'update_fields': ['title', 'author', 'genre', 'cover_url', 'stock'],
        }
        if connection.vendor != 'mysql':
            upsert_kwargs['unique_fields'] = ['isbn']

        for start in range(0, len(books), BATCH_SIZE):
            Book.objects.bulk_create(books[start:start + BATCH_SIZE], **upsert_kwargs)
            done = min(start + BATCH_SIZE, len(books))
            if done % 20000 < BATCH_SIZE or done == len(books):
                self.stdout.write(f'  {done}/{len(books)}')

        self.stdout.write(self.style.SUCCESS(
            f'Import finished. {Book.objects.count()} books in the catalogue.'
        ))
