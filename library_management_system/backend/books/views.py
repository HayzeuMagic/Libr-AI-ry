from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response

from books.models import Book, UserEBookCollection
from books.serializers import BookSerializer

# The catalogue has ~200k rows; never serialise all of them in one response.
DEFAULT_LIMIT = 200
MAX_LIMIT = 500


def get_limit(request, default=DEFAULT_LIMIT):
    try:
        limit = int(request.GET.get('limit', default))
    except (TypeError, ValueError):
        limit = default
    return max(1, min(limit, MAX_LIMIT))


@api_view(['GET'])
@permission_classes([AllowAny])
def book_list(request):
    books = Book.objects.order_by('id')[:get_limit(request)]
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
def add_to_collection(request):
    book_id = request.data.get('book_id')
    if not book_id:
        return Response({'error': 'Missing book_id'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(id=int(book_id), is_ebook=True)
    except (TypeError, ValueError):
        return Response({'error': 'book_id must be a number'}, status=status.HTTP_400_BAD_REQUEST)
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
@permission_classes([AllowAny])
def search_books(request):
    query = request.GET.get('q', '').strip()
    isbn = request.GET.get('isbn', '').strip()
    category = request.GET.get('category', 'all').strip()
    ebook = request.GET.get('ebook', '').strip().lower()
    limit = get_limit(request)

    books = Book.objects.all()

    if ebook == 'true':
        books = books.filter(is_ebook=True)

    if isbn:
        isbn_clean = isbn.replace('-', '').replace(' ', '')
        books = books.filter(isbn__iexact=isbn_clean)
        serializer = BookSerializer(books[:limit], many=True)
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
    elif ebook != 'true':
        # An empty search used to return the whole 200k-book catalogue.
        return Response([])

    serializer = BookSerializer(books.order_by('id')[:limit], many=True)
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
