import os
import re
from collections import defaultdict

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from openai import OpenAI

from books.models import Book
from reservations.models import Reservation


client = OpenAI(api_key=settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY"))


def parse_book_suggestion(reply: str):
    """
    Extract a single "Title" and Author from the AI reply.
    Examples:
      "I recommend \"1984\" by George Orwell."
      1. "Dune" by Frank Herbert
    """
    patterns = [
        r'"([^"]+)"\s*(?:by|BY)\s+([A-Za-z0-9\s\.\-,]+?)(?=\.|,|\n|$)',
        r'book\s+"([^"]+)"\s*(?:by|BY)\s+([A-Za-z0-9\s\.\-,]+?)(?=\.|,|\n|$)',
    ]
    for pat in patterns:
        m = re.search(pat, reply, re.IGNORECASE)
        if m:
            return {"title": m.group(1).strip(), "author": m.group(2).strip()}
    return None


def get_book_stock_info(book):
    """
    Read stock fields based on your actual Book model.
    Your books app uses:
    - stock = total copies
    - available_count = currently available copies
    """
    total_copies = getattr(book, "stock", None)
    available_copies = getattr(book, "available_count", None)

    return {
        "total_copies": total_copies,
        "available_copies": available_copies,
        "is_available": (available_copies is not None and available_copies > 0),
    }


def serialize_book(book):
    stock = get_book_stock_info(book)
    return {
        "id": book.id,
        "title": book.title,
        "author": book.author,
        "genre": getattr(book, "genre", None),
        "cover_url": getattr(book, "cover_url", None),
        "available_copies": stock["available_copies"],
        "total_copies": stock["total_copies"],
        "is_available": stock["is_available"],
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat(request):
    user_message = request.data.get("message")
    history = request.data.get("history", [])

    if not user_message:
        return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    text_lower = user_message.lower()

    # ------- ADMIN INTENTS (staff only, keyword-based) -------
    admin_reply = None
    if user.is_staff:
        tl = text_lower

        has_student = "student" in tl or "students" in tl
        has_borrow = "borrow" in tl
        has_overdue = "overdue" in tl
        has_email = "email" in tl or "e-mail" in tl

        # 1) list students who currently have a borrowed book
        if has_student and has_borrow and not has_overdue and not has_email:
            active_statuses = ['borrowed', 'overdue']
            reservations = (
                Reservation.objects
                .filter(status__in=active_statuses)
                .select_related('user', 'book')
                .order_by('user__id', '-borrow_date')
            )

            if not reservations.exists():
                admin_reply = (
                    "There are currently no students with borrowed books. "
                    "If you have any other questions or need assistance, feel free to ask!"
                )
            else:
                grouped = defaultdict(list)
                for r in reservations:
                    key = (r.user.get_full_name() or r.user.username, r.user.email)
                    grouped[key].append(r)

                lines = [
                    "Here are the students who currently have a borrowed book in the library:"
                ]
                for (student_name, email), items in grouped.items():
                    lines.append(f"\n{student_name} ({email}):")
                    for r in items:
                        lines.append(
                            f"- {r.book.title} "
                            f"({r.borrow_date.date()} | {r.due_date.date()} | {r.status})"
                        )
                admin_reply = "\n".join(lines)

        # 2) list students with overdue books
        elif has_student and has_overdue and not has_email:
            overdue_reservations = (
                Reservation.objects
                .filter(status__in=['borrowed', 'overdue'], due_date__lt=timezone.now())
                .select_related('user', 'book')
                .order_by('user__id', '-due_date')
            )

            if not overdue_reservations.exists():
                admin_reply = (
                    "There are currently no students with overdue books. "
                    "All borrowed items are up to date."
                )
            else:
                grouped = defaultdict(list)
                for r in overdue_reservations:
                    key = (r.user.get_full_name() or r.user.username, r.user.email)
                    grouped[key].append(r)

                lines = ["Here are the students who currently have overdue books:"]
                for (student_name, email), items in grouped.items():
                    lines.append(f"\n{student_name} ({email}):")
                    for r in items:
                        lines.append(
                            f"- {r.book.title} "
                            f"({r.borrow_date.date()} | {r.due_date.date()} | {r.status})"
                        )
                admin_reply = "\n".join(lines)

        # 3) email students with overdue books – generate email text
        elif has_student and has_overdue and has_email:
            overdue_reservations = (
                Reservation.objects
                .filter(status__in=['borrowed', 'overdue'], due_date__lt=timezone.now())
                .select_related('user', 'book')
            )

            if not overdue_reservations.exists():
                admin_reply = (
                    "There are currently no students with overdue books, "
                    "so no reminder emails were generated."
                )
            else:
                email_body = (
                    "Subject: Reminder: Overdue Library Book\n\n"
                    "Dear Student,\n\n"
                    "Our records show that you currently have one or more overdue "
                    "library books. Please return your overdue items to the library "
                    "as soon as possible to avoid further penalties.\n\n"
                    "If you believe you received this message in error, "
                    "please contact the library staff.\n\n"
                    "Best regards,\n"
                    "Library Team\n"
                )

                grouped = defaultdict(list)
                for r in overdue_reservations:
                    key = (r.user.get_full_name() or r.user.username, r.user.email)
                    grouped[key].append(r)

                recipient_lines = []
                for (student_name, email), items in grouped.items():
                    recipient_lines.append(f"\n{student_name} ({email}):")
                    for r in items:
                        recipient_lines.append(
                            f"- {r.book.title} "
                            f"({r.borrow_date.date()} | {r.due_date.date()} | {r.status})"
                        )

                admin_reply = (
                    "A reminder email has been generated and is assumed to have been "
                    "sent to all students with overdue books.\n\n"
                    "Here is the email template used:\n\n"
                    f"{email_body}\n"
                    "The following students would receive this email:\n"
                    + "\n".join(recipient_lines)
                )

    if admin_reply is not None:
        return Response({
            "reply": admin_reply,
            "book_suggested": None,
        })

    # ------- INTENT DETECTION -------
    is_recommend_request = any(
        w in text_lower for w in ["recommend", "suggest", "pick a book", "borrow"]
    )
    is_info_request = any(
        p in text_lower
        for p in [
            "what is that book about",
            "what is this book about",
            "what is the book about",
            "what is this about",
            "what is that about",
            "tell me about",
            "explain",
            "summary of",
            "who wrote",
            "genres are available",
            "what genres do you have",
        ]
    )
    if is_info_request:
        is_recommend_request = False

    # detect if the user explicitly mentions "by <author>"
    author_filter = None
    by_match = re.search(r'\bby\s+([A-Za-z][A-Za-z\s\.\-]+)', user_message, re.IGNORECASE)
    if by_match and is_recommend_request:
        author_filter = by_match.group(1).strip()

    # ------- USER BORROWED CONTEXT -------
    try:
        borrowed_reservations = Reservation.objects.filter(
            user=user,
            status='borrowed'
        ).select_related('book')[:10]

        borrowed_books = [r.book for r in borrowed_reservations]
        borrowed_ids = [b.id for b in borrowed_books]

        borrowed_summary = [f"- {b.title} by {b.author}" for b in borrowed_books]
        user_books_context = (
            "Your currently borrowed books:\n" + "\n".join(borrowed_summary)
            if borrowed_summary
            else "You have no currently borrowed books."
        )
    except Exception as e:
        print("❌ Borrowed books error:", e)
        borrowed_ids = []
        user_books_context = "Unable to fetch your borrowed books."

    # ------- TOPIC / DB SEARCH -------
    try:
        raw = user_message.strip()
        lower = raw.lower()

        topic_only = None
        if "recommend" in lower and "about" in lower:
            try:
                after_about = raw.split("about", 1)[1].strip()
                topic_only = after_about.rstrip("?.!")
            except Exception:
                topic_only = None

        q = topic_only or raw

        # Remove common borrow/request phrases so title matching works better
        q = re.sub(r'\b(i want to|can i|please|borrow|reserve|find|get me|recommend|suggest)\b', ' ', q, flags=re.IGNORECASE)
        q = re.sub(r'\s+', ' ', q).strip().strip('"')

        topic_books = Book.objects.none()

        if author_filter:
            author_qs = Book.objects.filter(author__icontains=author_filter)
            if author_qs.exists():
                topic_books = author_qs
            else:
                topic_books = Book.objects.filter(
                    Q(title__icontains=q) |
                    Q(author__icontains=q) |
                    Q(genre__icontains=q)
                )
        else:
            topic_books = Book.objects.filter(
                Q(title__icontains=q) |
                Q(author__icontains=q) |
                Q(genre__icontains=q)
            )

        if not topic_books.exists():
            words = [w.rstrip('?.!,"') for w in q.split() if w.strip()]
            for w in words:
                topic_books = Book.objects.filter(
                    Q(title__icontains=w) |
                    Q(author__icontains=w) |
                    Q(genre__icontains=w)
                )
                if topic_books.exists():
                    break

    except Exception as e:
        print("❌ Topic search error:", e)
        topic_books = Book.objects.none()

    # ------- ENRICH BOOKS WITH AVAILABILITY -------
    matched_books = list(topic_books[:10]) if topic_books.exists() else []
    borrowable_books = []

    for b in matched_books:
        if b.id in borrowed_ids:
            continue

        stock = get_book_stock_info(b)
        if stock["is_available"]:
            borrowable_books.append(b)

    if matched_books:
        topic_lines = []
        for b in matched_books:
            stock = get_book_stock_info(b)
            available_text = "unknown"
            if stock["available_copies"] is not None and stock["total_copies"] is not None:
                available_text = f"{stock['available_copies']}/{stock['total_copies']}"
            elif stock["available_copies"] is not None:
                available_text = str(stock["available_copies"])

            topic_lines.append(
                f'- "{b.title}" by {b.author} '
                f'(genre: {getattr(b, "genre", "")}, available: {available_text})'
            )

        topic_context = (
            "Books in this library matching the topic (database results):\n"
            + "\n".join(topic_lines)
        )
    else:
        topic_context = (
            "No library books were found that directly match this topic, "
            "but you may still recommend books using your general knowledge."
        )

    # ------- FULL GENRE LIST -------
    try:
        genres_qs = (
            Book.objects
            .exclude(genre__isnull=True)
            .exclude(genre__exact='')
            .values_list('genre', flat=True)
            .distinct()
        )
        all_genres = sorted(genres_qs)
        genres_text = (
            "Distinct genres available in this library's database:\n- "
            + "\n- ".join(all_genres)
            if all_genres
            else "No genres are recorded in the database."
        )
    except Exception as e:
        print("❌ Genre list error:", e)
        genres_text = "Unable to retrieve genre list from the database."

    # ------- FAST PATH FOR RECOMMENDATION / BORROW FROM DB -------
    if is_recommend_request and borrowable_books:
        primary_book = borrowable_books[0]
        book_suggested = serialize_book(primary_book)

        other_lines = [
            f'- "{b.title}" by {b.author}'
            for b in borrowable_books[1:4]
        ]

        reply_lines = [
            f'"{primary_book.title}" by {primary_book.author}.',
            "This book is available in the library and can be borrowed."
        ]

        if other_lines:
            reply_lines.append("")
            reply_lines.append("Other available books you may like:")
            reply_lines.extend(other_lines)

        return Response({
            "reply": "\n".join(reply_lines),
            "book_suggested": book_suggested,
        })

    # ------- IF MATCHED BUT ALL COPIES UNAVAILABLE -------
    if is_recommend_request and matched_books and not borrowable_books:
        primary_book = matched_books[0]
        stock = get_book_stock_info(primary_book)
        availability_text = "currently unavailable"
        if stock["available_copies"] is not None and stock["total_copies"] is not None:
            availability_text = (
                f'currently unavailable ({stock["available_copies"]}/{stock["total_copies"]} available)'
            )

        return Response({
            "reply": (
                f'"{primary_book.title}" by {primary_book.author}.\n'
                f'This book exists in the library but is {availability_text}.'
            ),
            "book_suggested": {
                **serialize_book(primary_book),
                "is_available": False,
            },
        })

    # ------- SYSTEM PROMPT -------
    system_prompt = (
        f"{user_books_context}\n\n"
        f"{topic_context}\n\n"
        f"{genres_text}\n\n"
        "ROLE:\n"
        "- You are a librarian for THIS library.\n\n"
        "INTENT HANDLING:\n"
        "- If the user asks to RECOMMEND, SUGGEST, or BORROW a book, treat it as a RECOMMENDATION REQUEST.\n"
        "- If the user asks what a book is about, or about an author, treat it as an INFORMATION QUESTION.\n"
        "- If the user asks to recommend a book BY a specific author, treat it as a RECOMMENDATION REQUEST FILTERED BY THAT AUTHOR.\n\n"
        "RECOMMENDATION RULES:\n"
        "- If the topic list above contains one or more library books, prefer library books.\n"
        "- Never say a library book is unavailable unless the database context explicitly shows 0 available copies.\n"
        "- If the topic list above is empty, you may recommend at least one real book using general knowledge.\n"
        "- Never respond that you cannot find any books on a topic. Always recommend something relevant.\n"
        "- For RECOMMENDATION REQUESTS FILTERED BY AUTHOR, prefer books whose author matches the requested author name when possible.\n"
        "- Your first line MUST be exactly one book in the format: \"Title\" by Author.\n"
        "- Do not suggest books already borrowed by the user.\n"
        "- If the user didn't specify a topic or genre, ask the user what topic or genre they want.\n"
        "- After the first line, you may add a short explanation.\n\n"
        "INFORMATION RULES:\n"
        "- For INFORMATION QUESTIONS, explain or summarize the book or author using your general knowledge.\n"
        "- If the user asks for the list or number of genres, use the genres list from the database above and report the actual genres and count.\n"
        "- When asked about a book that is not in the database, clarify first that it is not available in our library, but still give information about the book.\n"
        "- Do not treat information questions as new recommendations unless the user also asks for suggestions.\n"
    )

    # ------- BUILD MESSAGES WITH HISTORY -------
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:
        if "role" in msg and "content" in msg:
            messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.4,
            max_tokens=400,
        )
        bot_reply = completion.choices[0].message.content.strip()

        # Only attach a suggested book if the AI's answer can be mapped to a DB book
        book_suggested = None
        parsed = parse_book_suggestion(bot_reply)
        if parsed:
            title_hint = parsed["title"]
            author_hint = parsed["author"]

            book_obj = (
                Book.objects
                .filter(title__icontains=title_hint)
                .filter(author__icontains=author_hint.split()[0])
                .first()
            )

            if book_obj:
                book_suggested = serialize_book(book_obj)

        return Response({
            "reply": bot_reply,
            "book_suggested": book_suggested,
        })

    except Exception as e:
        print("❌ OPENAI ERROR:", repr(e))
        return Response(
            {"error": f"AI error: {str(e)}"},
            status=status.HTTP_502_BAD_GATEWAY
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def related_books(request):
    """
    Return up to 5 books related to the given book,
    based on shared genre and/or author.
    Used by the frontend 'Suggest More' button.
    """
    book_id = request.query_params.get("book_id")
    if not book_id:
        return Response({"error": "book_id is required"}, status=400)

    try:
        base = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        return Response({"error": "Book not found"}, status=404)

    qs = (
        Book.objects.filter(
            Q(genre__iexact=base.genre) |
            Q(author__icontains=base.author)
        )
        .exclude(id=base.id)
        .distinct()[:5]
    )

    data = [serialize_book(b) for b in qs]
    return Response({"related": data})