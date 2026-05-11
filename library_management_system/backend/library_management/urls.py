# library_management/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # User authentication + profile + change-password under /api/auth/...
    path('api/', include('users.urls')),

    # Book-related APIs under /api/books/...
    path('api/books/', include('books.urls')),

    # Reservation-related APIs under /api/reservations/...
    path('api/reservations/', include('reservations.urls')),

    # Chatbot APIs under /api/chatbot/...
    path('api/chatbot/', include('chatbot.urls')),

    path('api/analytics/', include('analytics.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
