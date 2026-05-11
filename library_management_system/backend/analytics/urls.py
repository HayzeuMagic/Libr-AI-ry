from django.http import JsonResponse
from django.urls import path
from . import views

urlpatterns = [
    path('ping/', lambda request: JsonResponse({'ok': True}), name='ping'),
    path('most-borrowed/', views.most_borrowed, name='most-borrowed'),
    path('recommendations/book/<int:book_id>/', views.students_also_borrowed, name='students-also-borrowed'),
]