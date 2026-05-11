from datetime import timedelta

from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response

from reservations.models import Reservation
from reservations.serializers import ReservationSerializer
from books.models import Book, UserEBookCollection
from books.serializers import BookSerializer
from books.ai_recommender import get_recommendations


@api_view(['GET'])
@permission_classes([AllowAny])
def book_list(request):
    books = Book.objects.all()
    serializer = BookSerializer(books, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated, IsAdminUser])
def book_detail(request, pk):
    try:
        book = Book.objects.get(pk=pk)
    except Book.DoesNotExist:
        return Response({'detail': 'Book not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = BookSerializer(book)
        return Response(serializer.data)

    serializer = BookSerializer(book, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reserve_book(request):
    book_id = request.data.get('book_id')
    if not book_id:
        return Response({'error': 'Missing book_id'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

    if book.is_ebook:
        return Response(
            {'error': 'E-books cannot be borrowed physically. Add them to your collection instead.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    active_count = Reservation.objects.filter(
        user=request.user,
        status='borrowed'
    ).count()

    if active_count >= 3:
        return Response(
            {
                'error': 'borrow_limit',
                'message': (
                    f'You already have {active_count} borrowed book(s). '
                    f'Please return one before borrowing more.'
                )
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    already_borrowed = Reservation.objects.filter(
        user=request.user,
        book=book,
        status='borrowed'
    ).exists()

    if already_borrowed:
        return Response(
            {'error': 'You have already borrowed this book.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if book.available_count <= 0:
        return Response({'error': 'Book not available'}, status=status.HTTP_400_BAD_REQUEST)

    reservation = Reservation.objects.create(
        user=request.user,
        book=book,
        due_date=timezone.now() + timedelta(days=7)
    )

    book.available_count = max(book.available_count - 1, 0)
    book.save()

    serializer = ReservationSerializer(reservation)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_collection(request):
    book_id = request.data.get('book_id')
    if not book_id:
        return Response({'error': 'Missing book_id'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(id=book_id, is_ebook=True)
    except Book.DoesNotExist:
        return Response({'error': 'E-book not found'}, status=status.HTTP_404_NOT_FOUND)

    if not book.pdf_file:
        return Response({'error': 'E-book PDF file is missing'}, status=status.HTTP_400_BAD_REQUEST)

    collection_item, created = UserEBookCollection.objects.get_or_create(
        user=request.user,
        book=book
    )

    if not created:
        return Response(
            {'message': 'E-book already in your collection.'},
            status=status.HTTP_200_OK
        )

    return Response(
        {'message': 'E-book added to your collection.'},
        status=status.HTTP_201_CREATED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_history(request):
    reservations = Reservation.objects.filter(
        user=request.user
    ).order_by('-borrow_date')
    serializer = ReservationSerializer(reservations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def return_book(request, pk):
    try:
        reservation = Reservation.objects.get(
            pk=pk,
            user=request.user,
            status='borrowed'
        )
    except Reservation.DoesNotExist:
        return Response(
            {'error': 'Reservation not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    reservation.return_date = timezone.now()
    reservation.status = (
        'returned' if reservation.return_date <= reservation.due_date
        else 'overdue'
    )
    reservation.save()

    book = reservation.book
    book.available_count = min(book.available_count + 1, book.stock)
    book.save()

    serializer = ReservationSerializer(reservation)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recommendations_api(request):
    query = request.GET.get('query', '')
    user_id = request.user.id
    recs = get_recommendations(user_id, query)
    return Response(recs)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_reservations(request):
    reservations = Reservation.objects.all().order_by('-borrow_date')
    serializer = ReservationSerializer(reservations, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def search_books(request):
    query = request.GET.get('q', '').strip()
    isbn = request.GET.get('isbn', '').strip()
    category = request.GET.get('category', 'all').strip()
    ebook = request.GET.get('ebook', '').strip().lower()

    books = Book.objects.all()

    if isbn:
        isbn_clean = isbn.replace('-', '').replace(' ', '')
        books = books.filter(isbn__iexact=isbn_clean)
        serializer = BookSerializer(books, many=True)
        return Response(serializer.data)

    if query:
        if category == 'title':
            books = books.filter(title__icontains=query)
        elif category == 'author':
            books = books.filter(author__icontains=query)
        elif category == 'genre':
            books = books.filter(genre__icontains=query)
        elif category == 'isbn':
            isbn_clean = query.replace('-', '').replace(' ', '')
            books = books.filter(isbn__iexact=isbn_clean)
        else:
            books = books.filter(
                Q(title__icontains=query) |
                Q(author__icontains=query) |
                Q(genre__icontains=query)
            )

    if ebook == 'true':
        books = books.filter(is_ebook=True)

    serializer = BookSerializer(books, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_ebooks(request):
    collection_items = UserEBookCollection.objects.filter(
        user=request.user,
        book__is_ebook=True
    ).select_related('book').order_by('-added_at')

    data = [
        {
            'id': item.book.id,
            'title': item.book.title,
            'author': item.book.author,
            'genre': item.book.genre,
            'cover_url': item.book.cover_url,
            'pdf_url': request.build_absolute_uri(item.book.pdf_file.url) if item.book.pdf_file else '',
        }
        for item in collection_items if item.book.pdf_file
    ]

    return Response(data, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_from_collection(request, book_id):
    try:
        collection_item = UserEBookCollection.objects.get(
            user=request.user,
            book_id=book_id
        )
    except UserEBookCollection.DoesNotExist:
        return Response(
            {'error': 'E-book not found in your collection.'},
            status=status.HTTP_404_NOT_FOUND
        )

    collection_item.delete()
    return Response(
        {'message': 'E-book removed from your collection.'},
        status=status.HTTP_200_OK
    )