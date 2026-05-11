# reservations/views.py
from datetime import timedelta

from django.utils import timezone
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

from reservations.models import (
    Reservation,
    DismissedNotification,
    PaymentRequest,
    RenewalRequest,
)
from reservations.serializers import ReservationSerializer
from books.models import Book
from books.ai_recommender import get_recommendations


BORROW_LIMIT = 3


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

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]

    # 1) Check stock only
    if getattr(book, "available_count", 0) <= 0:
        return Response(
            {'error': 'No available book in stock'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 2) Block if THIS user already has this specific book borrowed
    user_has_this_book = Reservation.objects.filter(
        user=request.user,
        book=book,
        status__in=active_statuses
    ).exists()

    if user_has_this_book:
        return Response(
            {'error': 'You have already borrowed this book.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 3) Enforce per-user borrow limit across all books
    user_active_count = Reservation.objects.filter(
        user=request.user,
        status__in=active_statuses
    ).count()

    if user_active_count >= BORROW_LIMIT:
        return Response(
            {
                'error': 'borrow_limit',
                'message': 'You already have 3 borrowed books, please return a book to borrow again.'
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 4) Create reservation and decrement stock
    reservation = Reservation.objects.create(
        user=request.user,
        book=book,
        due_date=timezone.now() + timedelta(days=7),
        status=getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
    )

    book.available_count -= 1
    book.save()

    serializer = ReservationSerializer(reservation)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reservation_history(request):
    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    reservations = (
        Reservation.objects
        .filter(user=request.user, status__in=active_statuses)
        .order_by('-borrow_date')
    )
    serializer = ReservationSerializer(reservations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def return_book(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk, user=request.user)
    except Reservation.DoesNotExist:
        return Response({'error': 'Reservation not found'}, status=status.HTTP_404_NOT_FOUND)

    reservation.return_date = timezone.now()
    reservation.status = getattr(Reservation, 'STATUS_RETURNED', 'returned')
    reservation.save()

    book = reservation.book
    book.available_count += 1
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
@permission_classes([IsAdminUser])
def all_reservations(request):
    qs = Reservation.objects.all().order_by('-borrow_date')

    try:
        page      = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 15))
    except ValueError:
        return Response({'error': 'Invalid page or page_size'}, status=status.HTTP_400_BAD_REQUEST)

    if page < 1:
        page = 1
    if page_size <= 0:
        page_size = 15

    total = qs.count()
    start = (page - 1) * page_size
    end   = start + page_size

    reservations = qs[start:end]
    serializer   = ReservationSerializer(reservations, many=True)
    data         = list(serializer.data)

    now = timezone.now()
    for item, obj in zip(data, reservations):
        item['overdue_unreturned'] = (
            obj.return_date is None
            and obj.due_date is not None
            and obj.due_date < now
        )

    return Response({
        'results':      data,
        'page':         page,
        'page_size':    page_size,
        'total':        total,
        'total_pages':  (total + page_size - 1) // page_size,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_borrowers_list(request):
    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]

    reservations = (
        Reservation.objects
        .filter(status__in=active_statuses)
        .select_related('user', 'book')
        .order_by('-borrow_date')
    )

    data = []
    for r in reservations:
        data.append({
            "student":    r.user.get_full_name() or r.user.username,
            "email":      r.user.email,
            "book_title": r.book.title,
            "borrow_date": r.borrow_date,
            "due_date":   r.due_date,
            "status":     r.status,
        })

    return Response({"results": data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_book_availability(request):
    title = request.query_params.get('title', '').strip()
    if not title:
        return Response({'error': 'title is required'}, status=400)

    book = Book.objects.filter(title__icontains=title).first()
    if not book:
        return Response({'status': 'not_found'})

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    active_res = (
        Reservation.objects
        .filter(book=book, status__in=active_statuses)
        .select_related('user')
        .first()
    )

    user_has_book = Reservation.objects.filter(
        book=book,
        user=request.user,
        status__in=active_statuses,
    ).exists()

    data = {
        'status':        'available' if not active_res else 'unavailable',
        'book_title':    book.title,
        'user_has_book': user_has_book,
    }

    if active_res:
        data['borrower_username'] = active_res.user.username

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def export_reservations_excel(request):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reservations"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
    center      = Alignment(horizontal="center")

    headers    = ["Student", "Book", "Borrowed On", "Due Date", "Returned On", "Status"]
    col_widths = [25, 55, 18, 18, 18, 15]

    for col, (header, width) in enumerate(zip(headers, col_widths), 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font      = header_font
        cell.fill      = header_fill
        cell.alignment = center
        ws.column_dimensions[cell.column_letter].width = width

    reservations = Reservation.objects.select_related('user', 'book').all().order_by('-borrow_date')
    now = timezone.now()

    for row, res in enumerate(reservations, 2):
        is_overdue_unreturned = (
            res.return_date is None
            and res.due_date is not None
            and res.due_date < now
        )
        display_status = "OVERDUE" if is_overdue_unreturned else res.status.capitalize()

        ws.cell(row=row, column=1, value=res.user.get_full_name() or res.user.username)
        ws.cell(row=row, column=2, value=res.book.title)
        ws.cell(row=row, column=3, value=res.borrow_date.strftime('%Y-%m-%d') if res.borrow_date else "-")
        ws.cell(row=row, column=4, value=res.due_date.strftime('%Y-%m-%d')    if res.due_date    else "-")
        ws.cell(row=row, column=5, value=res.return_date.strftime('%Y-%m-%d') if res.return_date else "-")
        ws.cell(row=row, column=6, value=display_status)

        if is_overdue_unreturned:
            red_fill = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
            for col in range(1, 7):
                ws.cell(row=row, column=col).fill = red_fill

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = 'attachment; filename="reservations.xlsx"'
    wb.save(response)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_notifications(request):
    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    reservations = Reservation.objects.filter(
        user=request.user,
        status__in=active_statuses
    ).select_related('book')

    dismissed = set(
        DismissedNotification.objects
        .filter(user=request.user)
        .values_list('notification_id', flat=True)
    )

    notifications = []
    now = timezone.now()

    for r in reservations:
        if r.due_date and r.due_date < now and not r.return_date:
            notif_id = f'overdue-{r.id}'
            if notif_id not in dismissed:
                notifications.append({
                    'id':         notif_id,
                    'type':       'overdue',
                    'message':    f'"{r.book.title}" is overdue. Please settle your payments and return the book.',
                    'book_title': r.book.title,
                    'due_date':   r.due_date.strftime('%Y-%m-%d'),
                })
        elif r.due_date and r.due_date.date() == now.date():
            notif_id = f'due-{r.id}'
            if notif_id not in dismissed:
                notifications.append({
                    'id':         notif_id,
                    'type':       'due_today',
                    'message':    f'"{r.book.title}" is due today. Please return it.',
                    'book_title': r.book.title,
                    'due_date':   r.due_date.strftime('%Y-%m-%d'),
                })
        elif r.due_date and r.due_date.date() == (now + timedelta(days=1)).date():
            notif_id = f'due-soon-{r.id}'
            if notif_id not in dismissed:
                notifications.append({
                    'id':         notif_id,
                    'type':       'due_soon',
                    'message':    f'"{r.book.title}" is due tomorrow. Please prepare to return it.',
                    'book_title': r.book.title,
                    'due_date':   r.due_date.strftime('%Y-%m-%d'),
                })
        else:
            notif_id = f'borrowed-{r.id}'
            if notif_id not in dismissed:
                notifications.append({
                    'id':         notif_id,
                    'type':       'borrowed',
                    'message':    f'"{r.book.title}" has been added to your library.',
                    'book_title': r.book.title,
                    'due_date':   r.due_date.strftime('%Y-%m-%d') if r.due_date else None,
                })

    return Response({'notifications': notifications})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def dismiss_notification(request, notification_id):
    DismissedNotification.objects.get_or_create(
        user=request.user,
        notification_id=notification_id
    )
    return Response({'status': 'dismissed'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def renew_book(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk, user=request.user)
    except Reservation.DoesNotExist:
        return Response({'error': 'Reservation not found'}, status=status.HTTP_404_NOT_FOUND)

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    if reservation.status not in active_statuses:
        return Response({'error': 'Only active reservations can be renewed'}, status=status.HTTP_400_BAD_REQUEST)

    if reservation.return_date:
        return Response({'error': 'Returned books cannot be renewed'}, status=status.HTTP_400_BAD_REQUEST)

    renewal, created = RenewalRequest.objects.get_or_create(
        reservation=reservation,
        defaults={'user': request.user, 'status': RenewalRequest.STATUS_PENDING}
    )

    if not created and renewal.status == RenewalRequest.STATUS_PENDING:
        return Response(
            {'message': 'Renewal request already pending.', 'renewal_status': renewal.status},
            status=status.HTTP_200_OK
        )

    if not created and renewal.status == RenewalRequest.STATUS_CONFIRMED:
        renewal.status = RenewalRequest.STATUS_PENDING
        renewal.save()

    return Response(
        {'message': 'Renewal request submitted. Waiting for admin confirmation.', 'renewal_status': 'pending'},
        status=status.HTTP_200_OK
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_pending_renewals(request):
    pending_ids = RenewalRequest.objects.filter(
        user=request.user,
        status=RenewalRequest.STATUS_PENDING
    ).values_list('reservation_id', flat=True)

    return Response({'pending_reservation_ids': list(pending_ids)})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_return_book(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk)
    except Reservation.DoesNotExist:
        return Response({'error': 'Reservation not found'}, status=status.HTTP_404_NOT_FOUND)

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    if reservation.status not in active_statuses:
        return Response({'error': 'Book is already returned'}, status=status.HTTP_400_BAD_REQUEST)

    reservation.return_date = timezone.now()
    reservation.status      = getattr(Reservation, 'STATUS_RETURNED', 'returned')
    reservation.save()

    book = reservation.book
    book.available_count += 1
    book.save()

    serializer = ReservationSerializer(reservation)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_payment(request, pk):
    try:
        reservation = Reservation.objects.get(pk=pk, user=request.user)
    except Reservation.DoesNotExist:
        return Response({'error': 'Reservation not found'}, status=status.HTTP_404_NOT_FOUND)

    payment, created = PaymentRequest.objects.get_or_create(
        reservation=reservation,
        defaults={'user': request.user, 'status': PaymentRequest.STATUS_PENDING}
    )

    return Response({
        'message':       'Payment submitted. Waiting for admin confirmation.',
        'payment_status': payment.status,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_pending_payments(request):
    pending_ids = PaymentRequest.objects.filter(
        user=request.user,
        status=PaymentRequest.STATUS_PENDING
    ).values_list('reservation_id', flat=True)

    return Response({'pending_reservation_ids': list(pending_ids)})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_pending_payments(request):
    payments = (
        PaymentRequest.objects
        .filter(status=PaymentRequest.STATUS_PENDING)
        .select_related('reservation__user', 'reservation__book')
        .order_by('-created_at')
    )

    data = []
    for p in payments:
        r = p.reservation
        data.append({
            'payment_id':     p.id,
            'reservation_id': r.id,
            'student':        r.user.get_full_name() or r.user.username,
            'email':          r.user.email,
            'book_title':     r.book.title,
            'borrow_date':    r.borrow_date,
            'due_date':       r.due_date,
            'status':         p.status,
        })

    return Response({'results': data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_confirm_payment(request, payment_id):
    try:
        payment = PaymentRequest.objects.select_related(
            'reservation__book'
        ).get(pk=payment_id)
    except PaymentRequest.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

    reservation = payment.reservation

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    if reservation.status not in active_statuses:
        return Response({'error': 'Book is already returned'}, status=status.HTTP_400_BAD_REQUEST)

    payment.status = PaymentRequest.STATUS_CONFIRMED
    payment.save()

    reservation.return_date = timezone.now()
    reservation.status      = getattr(Reservation, 'STATUS_RETURNED', 'returned')
    reservation.save()

    book = reservation.book
    book.available_count += 1
    book.save()

    return Response({'message': 'Payment confirmed and book returned successfully.'})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_pending_renewals(request):
    renewals = (
        RenewalRequest.objects
        .filter(status=RenewalRequest.STATUS_PENDING)
        .select_related('reservation__user', 'reservation__book')
        .order_by('-created_at')
    )

    data = []
    for req in renewals:
        r = req.reservation
        data.append({
            'renewal_id':     req.id,
            'reservation_id': r.id,
            'student':        r.user.get_full_name() or r.user.username,
            'email':          r.user.email,
            'book_title':     r.book.title,
            'borrow_date':    r.borrow_date,
            'due_date':       r.due_date,
            'status':         req.status,
        })

    return Response({'results': data})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_confirm_renewal(request, renewal_id):
    try:
        renewal = RenewalRequest.objects.select_related('reservation').get(pk=renewal_id)
    except RenewalRequest.DoesNotExist:
        return Response({'error': 'Renewal request not found'}, status=status.HTTP_404_NOT_FOUND)

    reservation = renewal.reservation

    active_statuses = [
        getattr(Reservation, 'STATUS_BORROWED', 'borrowed'),
        getattr(Reservation, 'STATUS_OVERDUE', 'overdue'),
    ]
    if reservation.status not in active_statuses:
        return Response({'error': 'Only active reservations can be renewed'}, status=status.HTTP_400_BAD_REQUEST)

    base_date = (
        reservation.due_date
        if reservation.due_date and reservation.due_date > timezone.now()
        else timezone.now()
    )
    reservation.due_date = base_date + timedelta(days=7)
    reservation.status   = getattr(Reservation, 'STATUS_BORROWED', 'borrowed')
    reservation.save()

    renewal.status = RenewalRequest.STATUS_CONFIRMED
    renewal.save()

    return Response({'message': 'Renewal confirmed successfully.'})