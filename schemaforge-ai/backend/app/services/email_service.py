import smtplib
from email.message import EmailMessage

from app.config import settings


def is_configured() -> bool:
    sender = settings.smtp_from_email or settings.smtp_username
    if settings.smtp_username and not settings.smtp_password:
        return False
    return bool(settings.smtp_host and settings.smtp_port and sender and settings.support_email)


def send_feedback_notification(
    *,
    feedback_id: str,
    feedback_type: str,
    name: str,
    sender_email: str,
    subject: str,
    message: str,
    page_url: str | None,
    user_agent: str | None,
) -> dict:
    if not is_configured():
        return {"sent": False, "reason": "SMTP is not configured"}

    from_email = settings.smtp_from_email or settings.smtp_username
    display_subject = subject or f"New {feedback_type} message"

    email = EmailMessage()
    email["From"] = from_email
    email["To"] = settings.support_email
    email["Subject"] = f"[SchemaForge AI] {display_subject}"
    if sender_email:
        email["Reply-To"] = sender_email

    email.set_content(
        "\n".join(
            [
                f"Feedback ID: {feedback_id}",
                f"Type: {feedback_type}",
                f"Name: {name or 'Not provided'}",
                f"Email: {sender_email or 'Not provided'}",
                f"Subject: {subject or 'Not provided'}",
                "",
                "Message:",
                message,
                "",
                f"Page URL: {page_url or 'Not provided'}",
                f"User Agent: {user_agent or 'Not provided'}",
            ]
        )
    )

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                _login_if_needed(smtp)
                smtp.send_message(email)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                _login_if_needed(smtp)
                smtp.send_message(email)
    except Exception as exc:
        return {"sent": False, "reason": str(exc)}

    return {"sent": True}


def _login_if_needed(smtp: smtplib.SMTP) -> None:
    if settings.smtp_username and settings.smtp_password:
        smtp.login(settings.smtp_username, settings.smtp_password)
