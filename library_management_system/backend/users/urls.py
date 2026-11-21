from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('login/', views.login, name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', views.profile, name='profile'),
    path('change-password/', views.change_password, name='change-password'),
    path('current-user/', views.current_user, name='current-user'),
    path('bulk-create-users/', views.bulk_create_users, name='bulk-create-users'),
    path('list-users/', views.list_users, name='list-users'),
]
