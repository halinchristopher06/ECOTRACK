package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.UpdateNotificationPreferenceRequest;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.Notification;
import com.ecotrack.backend.model.NotificationPreference;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.repository.NotificationPreferenceRepository;
import com.ecotrack.backend.repository.NotificationRepository;
import com.ecotrack.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final EmailService emailService;
    private final Duration mailConfirmWindow;

    public NotificationService(
            NotificationRepository notificationRepository,
            NotificationPreferenceRepository preferenceRepository,
            UserRepository userRepository,
            AuthService authService,
            EmailService emailService,
            @Value("${app.mail.confirm-timeout-seconds:6}") long mailConfirmTimeoutSeconds
    ) {
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
        this.userRepository = userRepository;
        this.authService = authService;
        this.emailService = emailService;
        this.mailConfirmWindow = Duration.ofSeconds(Math.max(1, mailConfirmTimeoutSeconds));
    }

    /** By userId directly — used both by the token-based controller path and the (token-free) scheduler. */
    public NotificationPreference getOrCreateDefaultPreferences(String userId) {
        return preferenceRepository.findByUserId(userId).orElseGet(() -> {
            NotificationPreference pref = new NotificationPreference();
            pref.setId(UUID.randomUUID().toString());
            pref.setUserId(userId);
            pref.setUpdatedAt(Instant.now());
            return preferenceRepository.save(pref);
        });
    }

    public NotificationPreference getPreferences(String token) {
        UserAccount user = authService.requireUser(token);
        return getOrCreateDefaultPreferences(user.getId());
    }

    public NotificationPreference updatePreferences(String token, UpdateNotificationPreferenceRequest request) {
        UserAccount user = authService.requireUser(token);
        NotificationPreference pref = getOrCreateDefaultPreferences(user.getId());
        if (request.emailEnabled() != null) pref.setEmailEnabled(request.emailEnabled());
        if (request.paymentRemindersEnabled() != null) pref.setPaymentRemindersEnabled(request.paymentRemindersEnabled());
        if (request.overdueAlertsEnabled() != null) pref.setOverdueAlertsEnabled(request.overdueAlertsEnabled());
        if (request.budgetAlertsEnabled() != null) pref.setBudgetAlertsEnabled(request.budgetAlertsEnabled());
        if (request.anomalyAlertsEnabled() != null) pref.setAnomalyAlertsEnabled(request.anomalyAlertsEnabled());
        if (request.billUploadRemindersEnabled() != null) pref.setBillUploadRemindersEnabled(request.billUploadRemindersEnabled());
        if (request.monthlySummaryEnabled() != null) pref.setMonthlySummaryEnabled(request.monthlySummaryEnabled());
        pref.setUpdatedAt(Instant.now());
        return preferenceRepository.save(pref);
    }

    /**
     * Core dedup+preference-respecting creation path. If a notification with this dedupeKey
     * already exists for this user, does nothing (duplicate prevention). If the category is
     * disabled for this user, does nothing at all — not even an in-app row is logged, per the
     * spec's "configure notification preferences". Otherwise creates+saves the row, and attempts
     * an email (if the user's global emailEnabled switch is on) without ever letting a failed
     * send block the in-app notification from being recorded.
     */
    public void createIfNew(String userId, String type, String dedupeKey, String title, String message, boolean categoryEnabled) {
        if (notificationRepository.existsByUserIdAndDedupeKey(userId, dedupeKey)) {
            return;
        }
        if (!categoryEnabled) {
            return;
        }

        NotificationPreference preferences = getOrCreateDefaultPreferences(userId);

        Notification notification = new Notification();
        notification.setId(UUID.randomUUID().toString());
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setDedupeKey(dedupeKey);
        notification.setRead(false);
        notification.setCreatedAt(Instant.now());

        boolean emailSent = false;
        if (preferences.isEmailEnabled()) {
            UserAccount user = userRepository.findById(userId).orElse(null);
            if (user != null && user.getEmail() != null) {
                // Best-effort: only record emailSent when SMTP actually confirmed it, so the flag
                // never claims a delivery that did not happen.
                emailSent = emailService.dispatch(user.getEmail(), title, message, mailConfirmWindow)
                        .confirmedSent();
            }
        }
        notification.setEmailSent(emailSent);

        notificationRepository.save(notification);
    }

    public List<Notification> listNotifications(String token) {
        UserAccount user = authService.requireUser(token);
        return notificationRepository.findByUserId(user.getId()).stream()
                .sorted(Comparator.comparing(Notification::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public Notification markRead(String token, String id, boolean read) {
        UserAccount user = authService.requireUser(token);
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Notification not found."));
        if (notification.getUserId() == null || !notification.getUserId().equals(user.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You do not have access to this notification.");
        }
        notification.setRead(read);
        return notificationRepository.save(notification);
    }
}
