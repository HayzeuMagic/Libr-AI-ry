from django.db.models import Count, Q

from .models import Book


def _book_dict(book):
    return {'id': book.id, 'title': book.title, 'author': book.author, 'genre': book.genre}


def get_recommendations(user_id, query=None, top_n=5):
    """
    Lightweight recommendations that work on the real Book schema
    (title / author / genre) and stay fast on a 200k-row catalogue.

    - With a query: books whose title/author/genre match the most query words.
    - Without a query: available books from the genres the user borrows most,
      falling back to the most-borrowed books overall.
    """
    # Imported here to avoid a circular import (reservations imports books).
    from reservations.models import Reservation

    borrowed_ids = set(
        Reservation.objects.filter(user_id=user_id)
        .exclude(book__isnull=True)
        .values_list('book_id', flat=True)
    )
    base = Book.objects.exclude(id__in=borrowed_ids).filter(available_count__gt=0)

    words = [w for w in (query or '').split() if len(w) > 2][:8]
    if words:
        match = Q()
        for w in words:
            match |= Q(title__icontains=w) | Q(author__icontains=w) | Q(genre__icontains=w)
        candidates = list(base.filter(match)[:200])

        def score(book):
            text = f'{book.title} {book.author} {book.genre}'.lower()
            return sum(1 for w in words if w.lower() in text)

        candidates.sort(key=score, reverse=True)
        return [_book_dict(b) for b in candidates[:top_n]]

    top_genres = list(
        Reservation.objects.filter(user_id=user_id)
        .exclude(book__isnull=True)
        .values('book__genre')
        .annotate(n=Count('id'))
        .order_by('-n')
        .values_list('book__genre', flat=True)[:3]
    )
    if top_genres:
        recs = list(base.filter(genre__in=top_genres).order_by('?')[:top_n])
        if recs:
            return [_book_dict(b) for b in recs]

    popular = (
        base.annotate(borrow_count=Count('reservation'))
        .filter(borrow_count__gt=0)
        .order_by('-borrow_count')[:top_n]
    )
    return [_book_dict(b) for b in popular]
