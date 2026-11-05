package com.ecotrack.backend.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Email-sending helper extracted from AuthService so the "is mail configured" guard and the
 * send/try-catch pattern are not duplicated across services that need to send email.
 *
 * <p>Delivery runs on a dedicated executor so a slow SMTP handshake does not occupy the HTTP
 * request thread. {@link #dispatch} still waits (briefly, and only up to the configured
 * confirmation window) for the outcome, because callers must be able to tell the difference
 * between "email confirmed sent", "still in flight" and "definitely failed" rather than
 * reporting a blanket success.
 */
@Service
public class EmailService {

    /**
     * Outcome of an email dispatch attempt.
     *
     * @param confirmedSent  the SMTP server accepted the message (delivery to the mailbox is still
     *                       up to the recipient's provider, but sending did not fail)
     * @param accepted       the attempt was dispatched but the outcome is not known yet (still in
     *                       flight, or the confirmation window elapsed). Callers must NOT report
     *                       this as a success.
     * @param reason         short machine-readable tag used for logging: sent | failed |
     *                       accepted | not-configured | disabled
     */
    public record DispatchResult(boolean confirmedSent, boolean accepted, String reason) {

        /** True only when we are sure the send did not succeed (and it is not still in flight). */
        public boolean definitelyFailed() {
            return !confirmedSent && !accepted;
        }
    }

    private final JavaMailSender mailSender;
    private final String mailUsername;
    private final Executor mailExecutor;
    private final boolean asyncEnabled;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${spring.mail.username:}") String mailUsername,
            @Qualifier("mailTaskExecutor") Executor mailExecutor,
            @Value("${app.mail.async:true}") boolean asyncEnabled
    ) {
        this.mailSender = mailSender;
        this.mailUsername = mailUsername == null ? "" : mailUsername.trim();
        this.mailExecutor = mailExecutor;
        this.asyncEnabled = asyncEnabled;
    }

    /** True when credentials look usable (a placeholder value means "not configured"). */
    public boolean isConfigured() {
        return StringUtils.hasText(mailUsername) && !mailUsername.contains("your-email");
    }

    /**
     * Sends a plain-text email, waiting up to {@code confirmWindow} for the result. Never throws —
     * a missing/misconfigured mail setup must not break the caller's own business logic.
     */
    public DispatchResult dispatch(String to, String subject, String body, Duration confirmWindow) {
        if (!isConfigured()) {
            System.out.println("Email skipped (" + to + "): spring.mail.username is not configured.");
            return new DispatchResult(false, false, "not-configured");
        }
        if (!asyncEnabled) {
            boolean sent = sendNow(to, subject, body);
            return new DispatchResult(sent, false, sent ? "sent" : "failed");
        }

        CompletableFuture<Boolean> future = CompletableFuture.supplyAsync(
                () -> sendNow(to, subject, body), mailExecutor);

        try {
            boolean sent = future.get(confirmWindow.toMillis(), TimeUnit.MILLISECONDS);
            return new DispatchResult(sent, false, sent ? "sent" : "failed");
        } catch (TimeoutException ex) {
            // The send is still running on the mail executor — report it honestly as unconfirmed.
            System.out.println("Email to " + to + " is still being delivered after "
                    + confirmWindow.toSeconds() + "s; reporting as accepted-but-unconfirmed.");
            return new DispatchResult(false, true, "accepted");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new DispatchResult(false, true, "accepted");
        } catch (ExecutionException ex) {
            System.err.println("Email dispatch failed for " + to + ": " + ex.getCause());
            return new DispatchResult(false, false, "failed");
        }
    }

    private boolean sendNow(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailUsername);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            System.out.println("Email sent successfully to: " + to);
            return true;
        } catch (Exception ex) {
            System.err.println("FAILED TO SEND EMAIL to " + to + ": " + ex.getMessage());
            return false;
        }
    }
}
