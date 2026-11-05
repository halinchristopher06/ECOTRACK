# EcoTrack OTP Setup

## Required For Live OTP Delivery

The backend loads mail credentials from the project-root `.env` file when started from the `backend` directory.

Set these values in `.env`:

```properties
spring.mail.username=your-email@gmail.com
spring.mail.password=your-16-digit-app-password
```

Keep `otp.demo-fallback-enabled=false` in `backend/src/main/resources/application.properties` for live email delivery.

## Notes

- `spring.mail.username` must be a Gmail address.
- `spring.mail.password` must be a 16-digit Gmail App Password.
- The `.env` file is git-ignored; do not commit your credentials.
- Set `otp.demo-fallback-enabled=true` if you want to test without sending real emails.

## Backend Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login/send-otp`
- `POST /api/auth/login/verify-otp`
- `POST /api/auth/login`

## Login Flow

1. Send OTP to email with `/api/auth/login/send-otp`
2. Verify OTP with `/api/auth/login/verify-otp`
3. Submit password with `/api/auth/login`

## Current Behavior

- Signup sends OTP to email only.
- Signup OTPs expire in 10 minutes.
- Login OTPs also expire in 10 minutes.
