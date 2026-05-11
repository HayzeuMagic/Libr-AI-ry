from rest_framework import serializers
from .models import Book

class BookSerializer(serializers.ModelSerializer):
    available_copies = serializers.SerializerMethodField()
    total_copies     = serializers.SerializerMethodField()

    class Meta:
        model  = Book
        fields = '__all__'

    def get_available_copies(self, obj):
        # available_count holds the real CSV Stock value
        return obj.available_count if obj.available_count else 0

    def get_total_copies(self, obj):
        # ✅ If stock wasn't imported (is 0 or 1 default), fall back to available_count
        # This prevents "3 of 1" — total can never be less than available
        total = obj.stock if obj.stock else 0
        available = obj.available_count if obj.available_count else 0
        return max(total, available)