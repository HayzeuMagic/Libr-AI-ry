from django.urls import path
from .views import (
    book_list,
    search_books,
    book_detail,
    my_ebooks,
    add_to_collection,
    remove_from_collection,
)

urlpatterns = [
    path('list/', book_list, name='book-list'),
    path('search/', search_books, name='book-search'),
    path('ebooks/', my_ebooks, name='my-ebooks'),
    path('add-to-collection/', add_to_collection, name='add-to-collection'),
    path('remove-from-collection/<int:book_id>/', remove_from_collection, name='remove-from-collection'),
    path('<int:pk>/', book_detail, name='book-detail'),
]