from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    """Every other response on this API is JSON — a genuinely unhandled
    exception (anything DRF's own handler doesn't recognize: Http404,
    PermissionDenied, ValidationError, etc. all already get a clean JSON
    response from it) would otherwise fall through to Django's raw HTML/text
    error page instead, breaking the frontend's response.json() parsing.
    Sentry still captures the real exception independently via its own
    signal-based hook — this only changes what the client receives."""
    response = exception_handler(exc, context)
    if response is not None:
        return response
    return Response({'error': 'Something went wrong. Please try again.'}, status=500)
