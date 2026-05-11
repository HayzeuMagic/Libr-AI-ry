import csv
import io

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer,
    ChangePasswordSerializer,
)

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAdminUser])
def bulk_create_users(request):
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded = file.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))
    except Exception:
        return Response({'error': 'Invalid CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

    required_fields = {'name', 'email'}
    fieldnames = {f.strip().lower() for f in reader.fieldnames} if reader.fieldnames else set()

    if not fieldnames or not required_fields.issubset(fieldnames):
        return Response(
            {'error': 'CSV must include at least: name, email'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    created = []
    skipped = []
    errors = []

    for idx, row in enumerate(reader, start=2):
        try:
            name = (row.get('name') or '').strip()
            email = (row.get('email') or '').strip().lower()
            password = (row.get('password') or '123').strip() or '123'

            if not name or not email:
                errors.append(f'Row {idx}: missing name or email')
                continue

            if User.objects.filter(email=email).exists():
                skipped.append(email)
                continue

            base_username = email.split('@')[0].strip()
            username = base_username
            suffix = 1

            while User.objects.filter(username=username).exists():
                username = f'{base_username}{suffix}'
                suffix += 1

            first_name, *rest = name.split(' ', 1)
            last_name = rest[0] if rest else ''

            User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )

            created.append(email)

        except Exception as e:
            print(f'BULK-CREATE-ERROR ROW {idx}: {e}')
            errors.append(f'Row {idx}: {str(e)}')

    return Response(
        {
            'created': len(created),
            'skipped': len(skipped),
            'errors': errors,
            'created_emails': created,
            'skipped_emails': skipped,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Email-based login.

    Accepts:
      - email + password
      - or username + password (fallback)
    """
    email = request.data.get('email')
    username = request.data.get('username')
    password = request.data.get('password')

    if not password or (not email and not username):
        return Response(
            {'error': 'Email (or username) and password are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        if email:
            user = User.objects.get(email=email)
        else:
            user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.check_password(password):
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {'error': 'User account is disabled'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    current_password = serializer.validated_data['current_password']
    new_password = serializer.validated_data['new_password']

    if not user.check_password(current_password):
        return Response(
            {'current_password': ['Incorrect current password.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()

    return Response(
        {'detail': 'Password updated successfully.'},
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_users(request):
    users = User.objects.all().order_by('-id')
    data = [
        {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_staff': user.is_staff,
        }
        for user in users
    ]
    return Response(data, status=status.HTTP_200_OK)