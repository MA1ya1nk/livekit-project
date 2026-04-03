from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Content

from app.config import settings


def send_email(to: str, subject: str, body_plain: str, body_html: str | None = None) -> None:
    message = Mail(
        from_email=settings.sendgrid_from_email,
        to_emails=to,
        subject=subject,
        plain_text_content=Content("text/plain", body_plain),
        html_content=Content("text/html", body_html or body_plain),
    )
    sg = SendGridAPIClient(api_key=settings.sendgrid_api_key)
    sg.send(message)
