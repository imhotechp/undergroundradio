from re import re
from django.contrib.auth.password_validation import validate_password

def validate_username(value):
    clean = value.trim().lower()
    check = re.search(r'^[a-zA-Z][a-zA-Z0-9_]{0,19}$', clean)
    return check

def validate_password(value):
    validate_password(value)  # <-- uses AUTH_PASSWORD_VALIDATORS
        return value