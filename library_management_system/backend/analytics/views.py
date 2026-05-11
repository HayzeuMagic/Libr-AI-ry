from django.http import JsonResponse

def most_borrowed(request):
    return JsonResponse({'view': 'most_borrowed'}, status=200)

def students_also_borrowed(request, book_id):
    return JsonResponse({'view': 'students_also_borrowed', 'bookId': book_id}, status=200)