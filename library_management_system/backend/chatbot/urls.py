from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('related-books/', views.related_books, name='related_books'),
]