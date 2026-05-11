from django.conf import settings
from django.db import models


class Book(models.Model):
    title = models.CharField(max_length=512)
    author = models.CharField(max_length=512, blank=True)
    isbn = models.CharField(max_length=32, unique=True)
    cover_url = models.URLField(blank=True)
    genre = models.CharField(max_length=100, blank=True)

    stock = models.PositiveIntegerField(default=0)
    available_count = models.PositiveIntegerField(default=0)

    is_ebook = models.BooleanField(default=False)
    pdf_file = models.FileField(upload_to='ebooks/', blank=True, null=True)

    def __str__(self):
        return self.title


class UserEBookCollection(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ebook_collection'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='in_user_collections'
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'book')

    def __str__(self):
        return f"{self.user} - {self.book.title}"