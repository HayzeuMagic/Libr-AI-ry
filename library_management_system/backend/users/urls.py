from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login, name='login'),
    path('profile/', views.profile, name='profile'),
    path('change-password/', views.change_password, name='change-password'),
    path('current-user/', views.current_user, name='current-user'),
    path('bulk-create-users/', views.bulk_create_users, name='bulk-create-users'),\
    path('list-users/', views.list_users, name='list-users'),
]