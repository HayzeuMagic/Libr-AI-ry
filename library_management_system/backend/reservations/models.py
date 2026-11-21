# reservations/models.py
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from books.models import Book


class Reservation(models.Model):
    STATUS_BORROWED = 'borrowed'
    STATUS_RETURNED = 'returned'
    STATUS_OVERDUE  = 'overdue'

    STATUS_CHOICES = [
        (STATUS_BORROWED, 'Borrowed'),
        (STATUS_RETURNED, 'Returned'),
        (STATUS_OVERDUE,  'Overdue'),
    ]

    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    book        = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True)
    borrow_date = models.DateTimeField(auto_now_add=True)
    due_date    = models.DateTimeField(blank=True, null=True)
    return_date = models.DateTimeField(blank=True, null=True)
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_BORROWED)

    def save(self, *args, **kwargs):
        if self.borrow_date and not self.due_date:
            self.due_date = self.borrow_date + timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def days_left(self):
        if not self.due_date:
            return None
        delta = self.due_date - timezone.now()
        return delta.days


class DismissedNotification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dismissed_notifications'
    )
    notification_id = models.CharField(max_length=100)
    dismissed_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'notification_id')

    def __str__(self):
        return f'{self.user.username} - {self.notification_id}'


class PaymentRequest(models.Model):
    STATUS_PENDING   = 'pending'
    STATUS_CONFIRMED = 'confirmed'

    PAYMENT_STATUS_CHOICES = [
        (STATUS_PENDING,   'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
    ]

    reservation = models.OneToOneField(
        Reservation,
        on_delete=models.CASCADE,
        related_name='payment_request'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payment_requests'
    )
    status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for reservation {self.reservation.id} — {self.status}"


class RenewalRequest(models.Model):
    STATUS_PENDING   = 'pending'
    STATUS_CONFIRMED = 'confirmed'

    RENEWAL_STATUS_CHOICES = [
        (STATUS_PENDING,   'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
    ]

    reservation = models.OneToOneField(
        Reservation,
        on_delete=models.CASCADE,
        related_name='renewal_request'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='renewal_requests'
    )
    status = models.CharField(
        max_length=20,
        choices=RENEWAL_STATUS_CHOICES,
        default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Renewal for reservation {self.reservation.id} — {self.status}"